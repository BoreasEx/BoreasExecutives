import { validateSupplierName } from "@/lib/suppliers";
import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

function extractTextFromParts(
  parts: Array<Record<string, unknown>> | undefined
): string {
  if (!parts || !Array.isArray(parts)) {
    return "";
  }

  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text))
    .join(" ")
    .trim();
}

type ScoreLevel = 0 | 1 | 2 | 3;
type BuyerStyle = "disqualifying" | "analytical" | "strategic";
type Step = 1 | 2 | 3 | 4 | 5;

type EvaluationScores = {
  offerStructure: ScoreLevel;
  technicalDepth: ScoreLevel;
  operationalCredibility: ScoreLevel;
  buyerRiskReduction: ScoreLevel;
};

type TechnicalSignals = {
  hasBrix: boolean;
  hasDefects: boolean;
  hasColor: boolean;
  hasIQF: boolean;
  hasForeignMaterial: boolean;
};

type NegotiationMemory = {
  producerName?: string;
  incoterm?: string;
  jurisdiction?: string;
};

function extractNegotiationMemory(
  uiMessages: ChatMessage[],
  lastUserMessageText: string
): NegotiationMemory {
  const combinedUserText = uiMessages
    .filter((m) => m.role === "user")
    .map((m) =>
      extractTextFromParts(m.parts as Array<Record<string, unknown>> | undefined)
    )
    .join(" \n ");

  const fullText = `${combinedUserText}\n${lastUserMessageText}`.toLowerCase();

  let producerName: string | undefined;
  let incoterm: string | undefined;
  let jurisdiction: string | undefined;

  const producerMatch =
    fullText.match(/producer called\s+([a-z0-9&.\- ]{2,60})/i) ||
    fullText.match(/processor called\s+([a-z0-9&.\- ]{2,60})/i) ||
    fullText.match(/producer is\s+([a-z0-9&.\- ]{2,60})/i) ||
    fullText.match(/processor is\s+([a-z0-9&.\- ]{2,60})/i);

  if (producerMatch?.[1]) {
    producerName = producerMatch[1].trim();
  }

  if (/\bex works\b|\bexw\b/i.test(fullText)) {
    incoterm = "EXW";
  } else if (/\bfob\b/i.test(fullText)) {
    incoterm = "FOB";
  } else if (/\bcif\b/i.test(fullText)) {
    incoterm = "CIF";
  }

  if (
    /egyptian jurisdiction|jurisdiction is egyptian|governed by egyptian law/i.test(
      fullText
    )
  ) {
    jurisdiction = "Egyptian";
  }

  return {
    producerName,
    incoterm,
    jurisdiction,
  };
}

const toneTemplates: Record<BuyerStyle, Record<keyof EvaluationScores, string>> =
  {
    disqualifying: {
      offerStructure: "Your offer is not structured enough to be reviewed.",
      technicalDepth: "You are not giving usable technical specifications.",
      operationalCredibility: "Operational control remains unclear.",
      buyerRiskReduction: "Nothing here materially reduces buyer risk.",
    },
    analytical: {
      offerStructure: "The offer is partially structured, but still incomplete.",
      technicalDepth: "Technical data is present, but still not robust enough.",
      operationalCredibility:
        "Execution control is mentioned, but not convincingly demonstrated.",
      buyerRiskReduction:
        "The offer remains only partially reassuring from a buyer standpoint.",
    },
    strategic: {
      offerStructure:
        "The commercial basis is acceptable. The issue is now differentiation.",
      technicalDepth: "Technical acceptability alone is not enough.",
      operationalCredibility:
        "Execution appears credible, but I still need stronger assurance.",
      buyerRiskReduction:
        "A credible file still needs a stronger buying rationale.",
    },
  };

const stepQuestions: Record<Step, string> = {
  1: "Present your offer clearly: product specs, crop, volume, price basis, and supply conditions.",
  2: "Be specific on technical quality: variety, Brix range, sizing, defect limits, packing, and broken fruit tolerance.",
  3: "What exactly do you guarantee on consistency from lot to lot?",
  4: "Clarify the producer setup and explain how you control traceability, quality, and pre-shipment conformity.",
  5: "Explain in practical terms why this supply should be considered commercially and operationally credible.",
};

const egyptianVarietiesCommon = ["festival", "fortuna"];
const egyptianVarietiesPlausible = [
  "camarosa",
  "sweet charlie",
  "sweet sensation",
  "radiance",
];

function clampScore(value: number): ScoreLevel {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value === 2) return 2;
  return 3;
}

function getStepThreshold(step: Step): ScoreLevel {
  switch (step) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 2;
    case 4:
      return 2;
    case 5:
      return 2;
  }
}

function getPriorityDimensions(step: Step): Array<keyof EvaluationScores> {
  switch (step) {
    case 1:
      return ["offerStructure", "technicalDepth"];
    case 2:
      return ["technicalDepth", "offerStructure"];
    case 3:
      return ["technicalDepth", "operationalCredibility"];
    case 4:
      return ["operationalCredibility", "technicalDepth"];
    case 5:
      return ["buyerRiskReduction", "operationalCredibility"];
  }
}

function didPassStep(scores: EvaluationScores, step: Step): boolean {
  const priorities = getPriorityDimensions(step);
  const threshold = getStepThreshold(step);

  return priorities.some((dimension) => scores[dimension] >= threshold);
}

function getScoredStep(scores: EvaluationScores): Step {
  if (!didPassStep(scores, 1)) return 1;
  if (!didPassStep(scores, 2)) return 2;
  if (!didPassStep(scores, 3)) return 3;
  if (!didPassStep(scores, 4)) return 4;
  return 5;
}

function getForcedStepFromTurnCount(uiMessages: ChatMessage[]): Step {
  const userTurns = uiMessages.filter((m) => m.role === "user").length;

  if (userTurns <= 2) return 1;
  if (userTurns <= 4) return 2;
  if (userTurns <= 6) return 3;
  if (userTurns <= 8) return 4;
  return 5;
}

function getCurrentStep(
  scores: EvaluationScores,
  uiMessages: ChatMessage[]
): Step {
  const scoredStep = getScoredStep(scores);
  const forcedStep = getForcedStepFromTurnCount(uiMessages);
  return Math.max(scoredStep, forcedStep) as Step;
}

function isConversationEnded(message: string): boolean {
  const text = message.toLowerCase();

  return (
    text.includes("we will not proceed") ||
    text.includes("we cannot proceed") ||
    text.includes("we cannot move forward") ||
    text.includes("we will not move forward") ||
    text.includes("i refuse") ||
    text.includes("not acceptable for us") ||
    text.includes("under these conditions, we cannot move forward") ||
    text.includes("under these conditions, we will not proceed") ||
    text.includes("we can move forward under conditions") ||
    text.includes("we can move forward subject to validation") ||
    text.includes("send your final offer") ||
    text.includes("submit the full file for review") ||
    text.includes("pause the process") ||
    text.includes("terminate the negotiation") ||
    text.includes("terminate this negotiation") ||
    text.includes("we will pause here") ||
    text.includes("we cannot proceed further") ||
    text.includes("validation remains suspended") ||
    text.includes("we acknowledge termination") ||
    text.includes("we acknowledge that we cannot proceed") ||
    text.includes("we will terminate the negotiation") ||
    text.includes("we must pause the process")
  );
}

function extractTechnicalSignals(message: string): TechnicalSignals {
  return {
    hasBrix: /brix/i.test(message),
    hasDefects: /defect|broken|damage|tolerance/i.test(message),
    hasColor: /color|colour|red|dark red|bright red/i.test(message),
    hasIQF: /iqf|separation|clump|clumping|free flowing|frozen/i.test(message),
    hasForeignMaterial: /leaf|green|foreign|calyx|peduncle/i.test(message),
  };
}

function scoreOfferStructure(message: string): ScoreLevel {
  const hasVolume = /volume|tons|tonnes|mt\b|qty|quantity/i.test(message);
  const hasPrice = /price|usd|eur|fob|cif|cnf/i.test(message);
  const hasSpecs = /brix|size|variety|grade|packing|crop/i.test(message);
  const hasSupply = /available|shipment|lead time|payment|terms/i.test(message);

  const count =
    Number(hasVolume) +
    Number(hasPrice) +
    Number(hasSpecs) +
    Number(hasSupply);

  return clampScore(count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3);
}

function scoreTechnicalDepth(message: string): ScoreLevel {
  const signals = extractTechnicalSignals(message);

  const count =
    Number(signals.hasBrix) +
    Number(signals.hasDefects) +
    Number(signals.hasColor) +
    Number(signals.hasIQF) +
    Number(signals.hasForeignMaterial);

  const hasVariety =
    /festival|fortuna|camarosa|sweet charlie|sweet sensation|radiance/i.test(
      message
    );
  const base = count + Number(hasVariety);

  return clampScore(base === 0 ? 0 : base <= 2 ? 1 : base <= 4 ? 2 : 3);
}

function scoreOperationalCredibility(message: string): ScoreLevel {
  const hasProducer =
    /producer|factory|plant|processor|grower|trader|intermediary/i.test(
      message
    );
  const hasTraceability = /traceability|traceable|batch|lot/i.test(message);
  const hasQC = /quality control|inspection|lab|testing|qa|qc/i.test(message);
  const hasShipment = /shipment|loading|pre-shipment|container/i.test(message);

  const count =
    Number(hasProducer) +
    Number(hasTraceability) +
    Number(hasQC) +
    Number(hasShipment);

  return clampScore(count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3);
}

function scoreBuyerRiskReduction(message: string): ScoreLevel {
  const hasRisk = /risk|secure|reliable|consistency|guarantee|compliance/i.test(
    message
  );
  const hasCommercial = /price|market|competitive|cost/i.test(message);
  const hasExecution =
    /traceability|shipment|quality control|producer|contract/i.test(message);
  const hasBuyerView =
    /industrial|buyer|approval|jam|processing|manufactur/i.test(message);

  const count =
    Number(hasRisk) +
    Number(hasCommercial) +
    Number(hasExecution) +
    Number(hasBuyerView);

  return clampScore(count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3);
}

function scoreConversation(
  uiMessages: ChatMessage[],
  lastUserMessageText: string
): EvaluationScores {
  const combinedUserText = uiMessages
    .filter((m) => m.role === "user")
    .map((m) =>
      extractTextFromParts(m.parts as Array<Record<string, unknown>> | undefined)
    )
    .join(" \n ");

  const fullText = `${combinedUserText}\n${lastUserMessageText}`.trim();

  return {
    offerStructure: scoreOfferStructure(fullText),
    technicalDepth: scoreTechnicalDepth(fullText),
    operationalCredibility: scoreOperationalCredibility(fullText),
    buyerRiskReduction: scoreBuyerRiskReduction(fullText),
  };
}

function getTotalScore(scores: EvaluationScores): number {
  return (
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction
  );
}

function getBuyerStyle(scores: EvaluationScores): BuyerStyle {
  const total = getTotalScore(scores);
  if (total <= 3) return "disqualifying";
  if (total <= 7) return "analytical";
  return "strategic";
}

function getRelevantWeakness(
  scores: EvaluationScores,
  step: Step
): keyof EvaluationScores {
  const priorities = [...getPriorityDimensions(step)];
  return priorities.sort((a, b) => scores[a] - scores[b])[0];
}

function detectVariety(message: string): string | null {
  const lower = message.toLowerCase();

  for (const variety of egyptianVarietiesCommon) {
    if (lower.includes(variety)) return variety;
  }

  for (const variety of egyptianVarietiesPlausible) {
    if (lower.includes(variety)) return variety;
  }

  const explicitVariety = lower.match(/variety[:\s]+([a-z\s-]+)/i);
  return explicitVariety?.[1]?.trim() ?? null;
}

function classifyVariety(
  variety: string | null
): "common" | "plausible" | "unknown" | "none" {
  if (!variety) return "none";
  if (egyptianVarietiesCommon.includes(variety)) return "common";
  if (egyptianVarietiesPlausible.includes(variety)) return "plausible";
  return "unknown";
}

function getVarietyContext(message: string): string {
  const variety = detectVariety(message);
  const varietyClass = classifyVariety(variety);

  if (varietyClass === "plausible") {
    return `VARIETY CONTEXT:
- The participant mentioned "${variety}", which is plausible in Egypt but less typical than Festival or Fortuna.
Instruction:
Do not reject it as false. Treat it as plausible but require clarification on why this variety is used and how it affects size, firmness, and consistency.`;
  }

  if (varietyClass === "unknown") {
    return `VARIETY CONTEXT:
- The participant mentioned "${variety}", which does not clearly align with standard Egyptian IQF strawberry supply.
Instruction:
Express doubt, ask for clarification, and test sourcing credibility. Do not state certainty unless documentation supports it.`;
  }

  return "";
}

function buildBoreasContext(
  uiMessages: ChatMessage[],
  lastUserMessageText: string
): string {
  const scores = scoreConversation(uiMessages, lastUserMessageText);
  const step = getCurrentStep(scores, uiMessages);
  const style = getBuyerStyle(scores);
  const weakness = getRelevantWeakness(scores, step);
  const toneLine = toneTemplates[style][weakness];
  const memory = extractNegotiationMemory(uiMessages, lastUserMessageText);
  const varietyContext = getVarietyContext(lastUserMessageText);

  let questionLine = stepQuestions[step];

  if (step === 4 && memory.producerName) {
    questionLine = `The producer ${memory.producerName} is noted. Describe in concrete terms how traceability, quality control, and pre-shipment conformity are managed.`;
  }

  if (step === 5 && memory.incoterm === "EXW") {
    questionLine =
      "Your Ex Works position is understood. Explain what concrete protections, compensation terms, and risk-mitigation mechanisms you offer despite that structure.";
  }

  return `BOREAS NEGOTIATION CONTEXT:
- Current step: ${step}
- Buyer style: ${style}
- Priority weakness: ${weakness}
- Producer already mentioned: ${memory.producerName ?? "no"}
- Incoterm already mentioned: ${memory.incoterm ?? "no"}
- Jurisdiction already mentioned: ${memory.jurisdiction ?? "no"}
- Invisible evaluation scores:
  - offerStructure: ${scores.offerStructure}/3
  - technicalDepth: ${scores.technicalDepth}/3
  - operationalCredibility: ${scores.operationalCredibility}/3
  - buyerRiskReduction: ${scores.buyerRiskReduction}/3

Behavior instructions:
- Stay strictly in buyer role
- Keep responses short and impactful
- Use this tone line as the behavioral direction: "${toneLine}"
- Focus primarily on this question or objection: "${questionLine}"
- Do not reveal scores, steps, or evaluation logic
- Do not become helpful
- If the answer is weak, challenge once only
- If the answer remains weak after one follow-up, briefly note the gap and move to the next validation point
- If the answer is structured, become more analytical and selective
- From step 5 onward, close the negotiation quickly and issue a clear proceed / pause / reject signal
- The supplier may be either the producer or a trader/intermediary
- The origin must remain Egypt

${varietyContext}`.trim();
}

type CertificationStatus = "fail" | "borderline" | "pass" | "strong_pass";

function getCertificationStatus(
  scores: EvaluationScores
): CertificationStatus {
  const total =
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction;

  const criticalZeros = [
    scores.technicalDepth,
    scores.operationalCredibility,
    scores.buyerRiskReduction,
  ].filter((v) => v === 0).length;

  if (total <= 4 || criticalZeros >= 2) return "fail";
  if (total <= 7 || criticalZeros === 1) return "borderline";
  if (total <= 10) return "pass";
  return "strong_pass";
}

function getCertificationVerdict(status: CertificationStatus): string {
  switch (status) {
    case "fail":
      return "The offer does not meet basic industrial buyer requirements.";
    case "borderline":
      return "The offer contains usable elements but remains too fragile for approval.";
    case "pass":
      return "The offer reaches a minimum credible level for industrial buyer review.";
    case "strong_pass":
      return "The offer is structured, credible, and defensible under buyer scrutiny.";
  }
}

function getKeyWeaknesses(scores: EvaluationScores): string[] {
  const weaknesses: string[] = [];

  if (scores.offerStructure <= 1) {
    weaknesses.push("Lack of structured commercial offer");
  }

  if (scores.technicalDepth <= 1) {
    weaknesses.push("Insufficient technical specifications");
  }

  if (scores.operationalCredibility <= 1) {
    weaknesses.push("Limited control over producer and execution");
  }

  if (scores.buyerRiskReduction <= 1) {
    weaknesses.push("Insufficient buyer risk mitigation");
  }

  return weaknesses.slice(0, 3);
}

function buildCertificationResult(scores: EvaluationScores) {
  const status = getCertificationStatus(scores);

  return {
    status,
    scores,
    verdict: getCertificationVerdict(status),
    weaknesses: getKeyWeaknesses(scores),
  };
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );

      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }

          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    const lastUserMessageText =
      message?.role === "user"
        ? extractTextFromParts(
            message.parts as Array<Record<string, unknown>> | undefined
          )
        : "";

    const supplierValidation = validateSupplierName(lastUserMessageText);

    let supplierContext = "";

    if (lastUserMessageText) {
      if (supplierValidation.status === "match") {
        supplierContext = `SUPPLIER VALIDATION CONTEXT:
- Supplier mention appears validated.
- Closest validated supplier: ${supplierValidation.matchedName}
- Confidence: ${supplierValidation.confidence}

Instruction:
Treat the supplier identity as plausible, but continue behaving as a strict industrial buyer. Do not become helpful.`;
      } else if (supplierValidation.status === "uncertain") {
        supplierContext = `SUPPLIER VALIDATION CONTEXT:
- Supplier identity is uncertain.
- Closest supplier found: ${supplierValidation.matchedName}
- Confidence: ${supplierValidation.confidence}

Instruction:
Express doubt. Require the full legal entity name and formal confirmation of the exact producer identity before moving forward.`;
      } else {
        supplierContext = `SUPPLIER VALIDATION CONTEXT:
- No credible supplier match found in the approved Egypt IQF supplier file.
- Closest candidate found: ${supplierValidation.matchedName ?? "None"}
- Confidence: ${supplierValidation.confidence}

Instruction:
Express serious doubt, suspend validation, and require documented justification and exact producer identification.`;
      }
    }

    const boreasScores = scoreConversation(uiMessages, lastUserMessageText);
    const currentStep = getCurrentStep(boreasScores, uiMessages);
    const certificationResult = buildCertificationResult(boreasScores);
    const boreasContext = buildBoreasContext(uiMessages, lastUserMessageText);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const shouldTriggerEvaluation =
          currentStep >= 5 && isConversationEnded(lastUserMessageText);

        if (shouldTriggerEvaluation) {
          dataStream.write({
            type: "data-clear",
            data: null,
          } as any);

          dataStream.write({
            type: "data-id",
            data: "certification-result",
          } as any);

          dataStream.write({
            type: "data-kind",
            data: "certification",
          } as any);

          dataStream.write({
            type: "data-title",
            data: "Certification Result",
          } as any);

          dataStream.write({
            type: "data-certification",
            data: certificationResult,
          } as any);

          dataStream.write({
            type: "data-finish",
            data: null,
          } as any);

          return;
        }

        const result = streamText({
          model: getLanguageModel(chatModel),
          system: `${systemPrompt({ requestHints, supportsTools })}

${boreasContext}

${supplierContext}`.trim(),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            isReasoningModel && !supportsTools
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "editDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          providerOptions: {},
          tools: {
            getWeather,
            createDocument: createDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            editDocument: editDocument({ dataStream, session }),
            updateDocument: updateDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              modelId: chatModel,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);

            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }

        try {
          const streamContext = getStreamContext();

          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}