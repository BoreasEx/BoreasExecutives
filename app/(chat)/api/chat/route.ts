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

/**
 * IMPORTANT
 * Ce fichier est une version de référence pour durcir le trigger Boreas.
 * Adaptez les imports DB / modèles / helpers exacts à votre repo si nécessaire.
 */

type BoreasScores = {
  offerStructure: number;
  technicalDepth: number;
  operationalCredibility: number;
  buyerRiskReduction: number;
};

type CertificationStatus = "fail" | "borderline" | "pass" | "strong_pass";

type CertificationPayload = {
  status: CertificationStatus;
  scores: BoreasScores;
  verdict: string;
  weaknesses: string[];
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * FIN DE CONVERSATION :
 * on ne matche QUE des phrases buyer réellement terminales.
 * Interdiction de matcher des phrases intermédiaires comme:
 * - validation is on hold
 * - remains unclear
 * - what exactly do you guarantee
 */
function isConversationEnded(text: string): boolean {
  const normalized = normalizeText(text);

  const terminalPhrases = [
    "we will not proceed",
    "i refuse this offer",
    "we can move forward under the following conditions",
    "we can move forward under conditions",
    "send the full supporting documents and we will proceed to review",
    "we are prepared to move to the next stage under the following conditions",
    "the discussion is closed",
    "we will stop here",
  ];

  return terminalPhrases.some((phrase) => normalized.includes(phrase));
}

function getLastMessageTextByRole(
  messages: Array<{ role?: string; content?: unknown }>
, role: "user" | "assistant"): string {
  const match = [...messages]
    .reverse()
    .find((message) => message.role === role);

  if (!match) return "";

  if (typeof match.content === "string") {
    return match.content;
  }

  if (Array.isArray(match.content)) {
    return match.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          "text" in part &&
          (part as { type?: string }).type === "text"
        ) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}

function countTurnsByRole(
  messages: Array<{ role?: string }>,
  role: "user" | "assistant"
): number {
  return messages.filter((message) => message.role === role).length;
}

/**
 * Adaptez cette fonction à votre moteur Boreas existant.
 * Ici, elle est volontairement déterministe et prudente.
 */
function computeBoreasState(messages: Array<{ role?: string; content?: unknown }>) {
  const lastUserMessageText = getLastMessageTextByRole(messages, "user");

  let scores: BoreasScores = {
    offerStructure: 0,
    technicalDepth: 0,
    operationalCredibility: 0,
    buyerRiskReduction: 0,
  };

  const normalized = normalizeText(lastUserMessageText);

  if (
    normalized.includes("offer") ||
    normalized.includes("price") ||
    normalized.includes("origin") ||
    normalized.includes("volume")
  ) {
    scores.offerStructure = Math.min(3, scores.offerStructure + 1);
  }

  if (
    normalized.includes("brix") ||
    normalized.includes("size") ||
    normalized.includes("variety") ||
    normalized.includes("spec") ||
    normalized.includes("festival")
  ) {
    scores.technicalDepth = Math.min(3, scores.technicalDepth + 1);
  }

  if (
    normalized.includes("producer") ||
    normalized.includes("factory") ||
    normalized.includes("traceability") ||
    normalized.includes("lot") ||
    normalized.includes("pre-shipment") ||
    normalized.includes("quality control")
  ) {
    scores.operationalCredibility = Math.min(3, scores.operationalCredibility + 1);
  }

  if (
    normalized.includes("risk") ||
    normalized.includes("mitigation") ||
    normalized.includes("claim") ||
    normalized.includes("replacement") ||
    normalized.includes("guarantee") ||
    normalized.includes("supporting documents")
  ) {
    scores.buyerRiskReduction = Math.min(3, scores.buyerRiskReduction + 1);
  }

  const total =
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction;

  /**
   * IMPORTANT
   * Ici on borne volontairement la progression.
   * Le step 5 ne doit être atteint qu’après suffisamment de tours.
   */
  const userTurns = countTurnsByRole(messages, "user");

  let currentStep = 1;
  if (userTurns >= 2 && total >= 2) currentStep = 2;
  if (userTurns >= 3 && total >= 4) currentStep = 3;
  if (userTurns >= 4 && total >= 6) currentStep = 4;
  if (userTurns >= 5 && total >= 8) currentStep = 5;

  return {
    scores,
    currentStep,
    lastUserMessageText,
    total,
  };
}

function buildCertificationPayload(scores: BoreasScores): CertificationPayload {
  const total =
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction;

  let status: CertificationStatus = "fail";
  if (total >= 10) status = "strong_pass";
  else if (total >= 8) status = "pass";
  else if (total >= 5) status = "borderline";

  const weaknesses = Object.entries(scores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([key]) => {
      switch (key) {
        case "offerStructure":
          return "Offer structure remains incomplete";
        case "technicalDepth":
          return "Technical precision remains insufficient";
        case "operationalCredibility":
          return "Limited control over producer and execution";
        case "buyerRiskReduction":
          return "Insufficient buyer risk mitigation";
        default:
          return "Weakness identified";
      }
    });

  const verdictByStatus: Record<CertificationStatus, string> = {
    fail: "The offer does not meet basic industrial buyer requirements.",
    borderline: "The offer shows some credibility but remains commercially fragile.",
    pass: "The offer reaches a credible industrial negotiation level.",
    strong_pass: "The offer demonstrates strong industrial and buyer-facing credibility.",
  };

  return {
    status,
    scores,
    verdict: verdictByStatus[status],
    weaknesses,
  };
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    id,
    messages,
    selectedChatModel,
  }: {
    id: string;
    messages: Array<{ id?: string; role?: string; content?: unknown }>;
    selectedChatModel: string;
  } = await request.json();

  if (!id || !Array.isArray(messages)) {
    return new Response("Invalid request body", { status: 400 });
  }

  const modelId =
    selectedChatModel && allowedModelIds.includes(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

  const userTurns = countTurnsByRole(messages, "user");
  const assistantTurns = countTurnsByRole(messages, "assistant");

  const { scores, currentStep, lastUserMessageText, total } =
    computeBoreasState(messages);

  const lastAssistantMessageText = getLastMessageTextByRole(messages, "assistant");

  /**
   * IMPORTANT
   * On détecte la fin sur le dernier message assistant/buyer,
   * pas sur le dernier message user.
   */
  const ended = isConversationEnded(lastAssistantMessageText);

  /**
   * GARDE-FOUS FORTS
   */
  const shouldTriggerEvaluation =
    currentStep === 5 &&
    ended &&
    userTurns >= 5 &&
    assistantTurns >= 5;

  console.log("BOREAS_TRIGGER_DEBUG", {
    chatId: id,
    modelId,
    currentStep,
    total,
    scores,
    userTurns,
    assistantTurns,
    ended,
    shouldTriggerEvaluation,
    lastUserMessageText,
    lastAssistantMessageText,
    lastMessageRole: messages[messages.length - 1]?.role ?? null,
  });

  console.log("BOREAS_END_CHECK_INPUT", {
    chatId: id,
    checkedText: lastAssistantMessageText,
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: modelId,
        system: systemPrompt({
          selectedChatModel: modelId,
          requestHints: {
            location: geolocation(request),
            ipAddress: ipAddress(request),
          } satisfies RequestHints,
        }),
        messages: convertToModelMessages(messages),
        stopWhen: stepCountIs(1),
        onFinish: async () => {
          /**
           * IMPORTANT
           * On ne pousse la certification qu’ici,
           * et seulement si les garde-fous ci-dessus sont validés.
           */
          if (!shouldTriggerEvaluation) {
            return;
          }

          const certification = buildCertificationPayload(scores);

          console.log("BOREAS_TRIGGER_FIRED", {
            chatId: id,
            currentStep,
            userTurns,
            assistantTurns,
            scores,
            certification,
          });

          writer.write({
            type: "data-certification",
            data: certification,
          });
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}