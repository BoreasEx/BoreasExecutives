import { NextResponse } from "next/server";

type ScoreLevel = 0 | 1 | 2 | 3;
type Step = 1 | 2 | 3 | 4 | 5;
type BuyerStyle = "disqualifying" | "analytical" | "strategic";
type CertificationStatus = "fail" | "borderline" | "pass" | "strong_pass";

type EvaluationScores = {
  offerStructure: ScoreLevel;
  technicalDepth: ScoreLevel;
  operationalCredibility: ScoreLevel;
  buyerRiskReduction: ScoreLevel;
};

type DebugMessage = {
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: Array<Record<string, unknown>>;
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

function getMessageText(message: DebugMessage | undefined): string {
  if (!message) return "";

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  return extractTextFromParts(message.parts);
}

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
    case 3:
    case 4:
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

function getCurrentStep(scores: EvaluationScores): Step {
  if (!didPassStep(scores, 1)) return 1;
  if (!didPassStep(scores, 2)) return 2;
  if (!didPassStep(scores, 3)) return 3;
  if (!didPassStep(scores, 4)) return 4;
  return 5;
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
    text.includes("submit the full file for review")
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
  messages: DebugMessage[],
  lastUserMessageText: string
): EvaluationScores {
  const combinedUserText = messages
    .filter((m) => m.role === "user")
    .map(getMessageText)
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
  priorities.sort((a, b) => scores[a] - scores[b]);
  return priorities[0];
}

function extractNegotiationMemory(
  messages: DebugMessage[],
  lastUserMessageText: string
): NegotiationMemory {
  const combinedUserText = messages
    .filter((m) => m.role === "user")
    .map(getMessageText)
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

  return { producerName, incoterm, jurisdiction };
}

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
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? (body.messages as DebugMessage[]) : [];

    if (messages.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "messages array is required",
        },
        { status: 400 }
      );
    }

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user") ?? null;
    const lastAssistantMessage =
      [...messages].reverse().find((m) => m.role === "assistant") ?? null;

    const lastUserMessageText = getMessageText(lastUserMessage ?? undefined);
    const lastAssistantMessageText = getMessageText(
      lastAssistantMessage ?? undefined
    );

    const scores = scoreConversation(messages, lastUserMessageText);
    const currentStep = getCurrentStep(scores);
    const buyerStyle = getBuyerStyle(scores);
    const dominantWeakness = getRelevantWeakness(scores, currentStep);
    const memory = extractNegotiationMemory(messages, lastUserMessageText);

    const conversationEnded = isConversationEnded(lastAssistantMessageText);
    const shouldTriggerEvaluation = currentStep >= 5 && conversationEnded;
    const certificationResult = buildCertificationResult(scores);

    return NextResponse.json({
      ok: true,
      debug: {
        messageCount: messages.length,
        lastUserMessageText,
        lastAssistantMessageText,
        scores,
        totalScore: getTotalScore(scores),
        currentStep,
        didPassCurrentStep: didPassStep(scores, currentStep),
        nextStep: currentStep,
        buyerStyle,
        dominantWeakness,
        priorityDimensions: getPriorityDimensions(currentStep),
        memory,
        conversationEnded,
        shouldTriggerEvaluation,
        certificationResult,
      },
    });
  } catch (error) {
    console.error("chat-debug failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "chat-debug failed",
      },
      { status: 500 }
    );
  }
}