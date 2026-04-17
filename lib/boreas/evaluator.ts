export type BuyerStyle = "disqualifying" | "analytical" | "strategic";

export type ScoreKey =
  | "offerStructure"
  | "technicalDepth"
  | "operationalCredibility"
  | "buyerRiskReduction";

export type Step = 1 | 2 | 3 | 4 | 5;
export type ScoreDimension = ScoreKey;

export type Scores = {
  offerStructure: number;
  technicalDepth: number;
  operationalCredibility: number;
  buyerRiskReduction: number;
};

export type BoreasScores = Scores;

export type ExpectedBuyerReaction = {
  toneLine: string;
  questionLine: string;
};

export type ExtractedMemory = {
  incoterm?: "EXW" | "FOB" | "CIF" | "CFR";
  producerName?: string;
};

export type ConversationMemory = ExtractedMemory;

export type EvaluationSignals = {
  keywordStuffingDetected: boolean;
};

export type EvaluatorDebug = {
  thresholdForStep: number;
  currentStepScore: number;
  reasons: string[];
};

export type EvaluatorResult = {
  scores: Scores;
  didPassStep: boolean;
  nextStep: number;
  dominantWeakness: ScoreKey;
  priorityDimensions: ScoreKey[];
  buyerStyle: BuyerStyle;
  expectedBuyerReaction: ExpectedBuyerReaction;
  extractedMemory: ExtractedMemory;
  evaluationSignals: EvaluationSignals;
  debug: EvaluatorDebug;
};

export type EvaluateInput = {
  text: string;
  currentStep: Step;
  previousScores?: BoreasScores;
  conversationMemory?: ConversationMemory;
};

export type EvaluateAnswerInput = {
  currentStep: Step;
  previousScores?: BoreasScores;
  conversationMemory?: ConversationMemory;
  userAnswer: string;
};

const MAX_SCORE = 3;

function clampScore(value: number): number {
  return Math.max(0, Math.min(MAX_SCORE, value));
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
}

function lower(text: string): string {
  return normalizeText(text).toLowerCase();
}

function wordCount(text: string): number {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  return words.length;
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractIncoterm(text: string): ExtractedMemory["incoterm"] | undefined {
  if (/\bEXW\b/i.test(text) || /\bEx Works\b/i.test(text)) return "EXW";
  if (/\bFOB\b/i.test(text) || /\bFree On Board\b/i.test(text)) return "FOB";
  if (/\bCIF\b/i.test(text)) return "CIF";
  if (/\bCFR\b/i.test(text)) return "CFR";
  return undefined;
}

function extractProducerName(text: string): string | undefined {
  const producerPatterns = [
    /\bproducer\s*[:\-]?\s*([A-Z][A-Za-z0-9&.\- ]{2,40})/i,
    /\bproduced by\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/i,
    /\bfrom producer\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/i,
    /\bthe producer\s+is\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/i,
  ];

  for (const pattern of producerPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.,;:]$/, "");
    }
  }

  const knownProducers = ["Givrex", "Dakahlia", "El Marwa", "Frozena"];
  for (const producer of knownProducers) {
    if (new RegExp(`\\b${producer}\\b`, "i").test(text)) {
      return producer;
    }
  }

  return undefined;
}

function getStepThreshold(currentStep: Step): number {
  switch (currentStep) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    default:
      return 2;
  }
}

function getPriorityDimensions(currentStep: Step): ScoreKey[] {
  switch (currentStep) {
    case 1:
      return ["offerStructure", "technicalDepth"];
    case 2:
      return ["technicalDepth", "offerStructure"];
    case 3:
      return ["technicalDepth", "offerStructure"];
    case 4:
      return ["operationalCredibility", "technicalDepth"];
    case 5:
      return ["buyerRiskReduction", "operationalCredibility"];
    default:
      return ["offerStructure", "technicalDepth"];
  }
}

function getExpectedBuyerReaction(
  currentStep: Step,
  memory: ExtractedMemory
): ExpectedBuyerReaction {
  switch (currentStep) {
    case 1:
      return {
        toneLine: "Your offer remains unclear and incomplete.",
        questionLine:
          "Present your offer clearly with product, origin, price basis, and available volume.",
      };
    case 2:
      return {
        toneLine: "Technical precision is insufficient.",
        questionLine:
          "Detail technical specs: Brix, sizing, defects, packing, and product format.",
      };
    case 3:
      return {
        toneLine: "Industrial consistency is not demonstrated.",
        questionLine:
          "Explain how you ensure consistency in raw material, processing, and packed goods across shipments.",
      };
    case 4:
      return memory.producerName
        ? {
            toneLine: "Operational reliability is not demonstrated.",
            questionLine: `The producer ${memory.producerName} is noted. Describe your production and quality control system in concrete terms.`,
          }
        : {
            toneLine: "Operational reliability is not demonstrated.",
            questionLine: "Describe your production and quality control system.",
          };
    case 5:
      return memory.incoterm === "EXW"
        ? {
            toneLine: "Risk coverage is not acceptable.",
            questionLine:
              "Your Ex Works position is understood. Explain what concrete protections, compensation terms, and risk-mitigation mechanisms you offer despite that structure.",
          }
        : {
            toneLine: "Risk coverage is not acceptable.",
            questionLine:
              "Explain why this supply is commercially reliable and what concrete guarantees protect the buyer.",
          };
    default:
      return {
        toneLine: "The answer remains insufficient.",
        questionLine: "Clarify your position in concrete business terms.",
      };
  }
}

function computeBuyerStyle(scores: Scores): BuyerStyle {
  const total =
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction;

  if (total <= 2) return "disqualifying";
  if (total <= 8) return "analytical";
  return "strategic";
}

function detectOfferStructureSignals(text: string, reasons: string[], scores: Scores) {
  const productMentioned = hasAny(text, [
    /\bstrawberry\b/i,
    /\bstrawberries\b/i,
    /\biqf strawberry\b/i,
    /\biqf strawberries\b/i,
  ]);

  const originMentioned = hasAny(text, [/\begypt\b/i, /\begyptian\b/i]);

  const commercialBasisMentioned = hasAny(text, [
    /\bFOB\b/i,
    /\bEXW\b/i,
    /\bCIF\b/i,
    /\bCFR\b/i,
    /\bUSD\b/i,
    /\bEUR\b/i,
    /\bprice\b/i,
    /\boffer\b/i,
  ]);

  const volumeMentioned = hasAny(text, [
    /\b\d+\s*(mt|tons?|tonnes?)\b/i,
    /\bavailable volume\b/i,
    /\bcontainer\b/i,
  ]);

  if (productMentioned) {
    reasons.push("Product identified");
    scores.offerStructure += 1;
  }

  if (originMentioned) {
    reasons.push("Origin identified");
    scores.offerStructure += 1;
  }

  if (commercialBasisMentioned || volumeMentioned) {
    reasons.push("Commercial offer structure identified");
    scores.offerStructure += 1;
  }
}

function detectTechnicalSignals(text: string, reasons: string[], scores: Scores) {
  const brixMentioned = hasAny(text, [/\bbrix\b/i, /\b\d{1,2}\s*°?\s*brix\b/i]);

  const sizingMentioned = hasAny(text, [
    /\b\d{1,2}\s*-\s*\d{1,2}\s*mm\b/i,
    /\b\d{1,2}\s*mm\b/i,
    /\bcm\b/i,
    /\bdiced\b/i,
    /\bcubes?\b/i,
    /\bsize\b/i,
    /\bsizing\b/i,
  ]);

  const technicalSpecsMentioned = hasAny(text, [
    /\bdefects?\b/i,
    /\bpacking\b/i,
    /\bpackaging\b/i,
    /\bformat\b/i,
    /\bmoisture\b/i,
    /\bcolor\b/i,
    /\bbrix\b/i,
    /\bcaliber\b/i,
  ]);

  if (brixMentioned) {
    reasons.push("Brix mentioned");
    scores.technicalDepth += 1;
  }

  if (sizingMentioned) {
    reasons.push("Sizing mentioned");
    scores.technicalDepth += 1;
  }

  if (technicalSpecsMentioned) {
    reasons.push("Technical specs mentioned");
    scores.technicalDepth += 1;
  }
}

function detectOperationalSignals(text: string, reasons: string[], scores: Scores) {
  const processMentioned = hasAny(text, [
    /\bprocess\b/i,
    /\bprocessed\b/i,
    /\bsorting\b/i,
    /\bgrading\b/i,
    /\bmetal detector\b/i,
    /\boptical sorting\b/i,
    /\btraceability\b/i,
    /\bpre-shipment\b/i,
  ]);

  const controlDepthMentioned = hasAny(text, [
    /\btraceability\b/i,
    /\bbatch\b/i,
    /\blot\b/i,
    /\bqa\b/i,
    /\bqc\b/i,
    /\bquality control\b/i,
    /\binspection\b/i,
  ]);

  const complianceMentioned = hasAny(text, [
    /\bconformity\b/i,
    /\bcompliance\b/i,
    /\banalysis\b/i,
    /\bcoa\b/i,
    /\bcertificate\b/i,
    /\bpesticide\b/i,
    /\bresidue\b/i,
  ]);

  const recognizedLabMentioned = hasAny(text, [
    /\bsgs egypt\b/i,
    /\bsgs\b/i,
    /\bagq\b/i,
    /\bzi-?7\b/i,
  ]);

  const structuredLabTesting = recognizedLabMentioned && hasAny(text, [
    /\btested\b/i,
    /\banalysis\b/i,
    /\breport\b/i,
    /\blab\b/i,
    /\bpesticide\b/i,
    /\bresidue\b/i,
  ]);

  if (processMentioned) {
    reasons.push("Process mentioned");
    scores.operationalCredibility += 1;
  }

  if (controlDepthMentioned) {
    reasons.push("Operational control depth detected");
    scores.operationalCredibility += 1;
  }

  if (complianceMentioned) {
    reasons.push("Compliance control mentioned");
  }

  if (recognizedLabMentioned) {
    reasons.push("Recognized lab mentioned");
  }

  if (structuredLabTesting) {
    reasons.push("Structured lab testing process");
  }
}

function detectRiskReductionSignals(text: string, reasons: string[], scores: Scores) {
  const insuranceMentioned = hasAny(text, [
    /\binsurance\b/i,
    /\binsured\b/i,
    /\bcovered\b/i,
  ]);

  const replacementMentioned = hasAny(text, [
    /\breplacement\b/i,
    /\breplace\b/i,
    /\bcompensation\b/i,
    /\bcredit note\b/i,
    /\bclaim\b/i,
  ]);

  const guaranteeMentioned = hasAny(text, [
    /\bguarantee\b/i,
    /\bprotect\b/i,
    /\brisk mitigation\b/i,
    /\bsupport\b/i,
    /\bresponsibility\b/i,
  ]);

  if (insuranceMentioned) {
    reasons.push("Insurance mentioned");
    scores.buyerRiskReduction += 1;
  }

  if (replacementMentioned) {
    reasons.push("Replacement mentioned");
    scores.buyerRiskReduction += 1;
  }

  if (guaranteeMentioned) {
    scores.buyerRiskReduction += 1;
  }
}

function detectCorrectiveActionBonus(
  text: string,
  reasons: string[],
  scores: Scores
): boolean {
  const incidentDetected = hasAny(text, [
    /\bpesticide incident\b/i,
    /\bincident\b/i,
    /\bissue\b/i,
    /\bnon-?conformity\b/i,
    /\brejection\b/i,
    /\bfailure\b/i,
  ]);

  const correctiveActionPresent = hasAny(text, [
    /\bcorrective action\b/i,
    /\bwe corrected\b/i,
    /\bwe stopped\b/i,
    /\bwe changed\b/i,
    /\bwe reinforced\b/i,
    /\bwe implemented\b/i,
    /\bwe reviewed\b/i,
    /\broot cause\b/i,
  ]);

  const recognizedLabMentioned = reasons.includes("Recognized lab mentioned");
  const processDescribed = reasons.includes("Process mentioned");

  if (
    incidentDetected &&
    correctiveActionPresent &&
    recognizedLabMentioned &&
    processDescribed
  ) {
    scores.operationalCredibility += 1;
    return true;
  }

  return false;
}

function detectKeywordStuffing({
  reasons,
  scores,
  text,
}: {
  reasons: string[];
  scores: Scores;
  text: string;
}): boolean {
  const stuffingSensitiveSignals = [
    "Commercial offer structure identified",
    "Brix mentioned",
    "Technical specs mentioned",
    "Process mentioned",
    "Operational control depth detected",
    "Insurance mentioned",
    "Replacement mentioned",
    "Compliance control mentioned",
    "Structured lab testing process",
  ];

  const detectedSignals = reasons.filter((reason) =>
    stuffingSensitiveSignals.includes(reason)
  );

  const totalWords = wordCount(text);

  const repeatedKeywordHits = [
    (text.match(/\bbrix\b/gi) || []).length,
    (text.match(/\bprocess\b/gi) || []).length,
    (text.match(/\btraceability\b/gi) || []).length,
    (text.match(/\binsurance\b/gi) || []).length,
    (text.match(/\breplacement\b/gi) || []).length,
    (text.match(/\bquality\b/gi) || []).length,
  ].reduce((sum, count) => sum + count, 0);

  const numericSupportCount = [
    /\b\d+\s*mm\b/gi,
    /\b\d+\s*-\s*\d+\s*mm\b/gi,
    /\b\d+\s*(mt|tons?|tonnes?)\b/gi,
    /\b\d{1,2}\s*°?\s*brix\b/gi,
    /\b\d+\s*kg\b/gi,
  ].reduce((sum, regex) => sum + ((text.match(regex) || []).length), 0);

  const connectionWordsCount = [
    /\bbecause\b/gi,
    /\btherefore\b/gi,
    /\bso that\b/gi,
    /\bas a result\b/gi,
    /\bin order to\b/gi,
    /\bwhich means\b/gi,
  ].reduce((sum, regex) => sum + ((text.match(regex) || []).length), 0);

  const tooManySignals = detectedSignals.length >= 5;
  const lowSubstance =
    totalWords < 120 ||
    (scores.technicalDepth <= 2 && scores.buyerRiskReduction <= 2);
  const weakSupport = numericSupportCount <= 1 && connectionWordsCount === 0;
  const suspiciousRepetition = repeatedKeywordHits >= 6;

  return tooManySignals && lowSubstance && (weakSupport || suspiciousRepetition);
}

function getDominantWeakness(
  scores: Scores,
  priorityDimensions: ScoreKey[]
): ScoreKey {
  const [firstPriority, secondPriority] = priorityDimensions;

  if (scores[firstPriority] <= scores[secondPriority]) {
    return firstPriority;
  }

  return secondPriority;
}

function getCurrentStepScore(scores: Scores, currentStep: Step): number {
  switch (currentStep) {
    case 1:
      return Math.min(scores.offerStructure, scores.technicalDepth);
    case 2:
      return scores.technicalDepth;
    case 3:
      return Math.min(scores.technicalDepth, scores.offerStructure);
    case 4:
      return scores.operationalCredibility;
    case 5:
      return scores.buyerRiskReduction;
    default:
      return 0;
  }
}

function getNextStep(currentStep: Step, didPassStep: boolean): number {
  if (!didPassStep) return currentStep;
  return Math.min(5, currentStep + 1);
}

export function evaluateResponse(input: EvaluateInput): EvaluatorResult {
  const rawText = input.text ?? "";
  const text = normalizeText(rawText);
  const lcText = lower(text);
  const currentStep = input.currentStep;

  const scores: Scores = {
    offerStructure: input.previousScores?.offerStructure ?? 0,
    technicalDepth: input.previousScores?.technicalDepth ?? 0,
    operationalCredibility: input.previousScores?.operationalCredibility ?? 0,
    buyerRiskReduction: input.previousScores?.buyerRiskReduction ?? 0,
  };

  const reasons: string[] = [];

  const extractedMemory: ExtractedMemory = {
    incoterm: extractIncoterm(text) ?? input.conversationMemory?.incoterm,
    producerName:
      extractProducerName(text) ?? input.conversationMemory?.producerName,
  };

  detectOfferStructureSignals(lcText, reasons, scores);
  detectTechnicalSignals(lcText, reasons, scores);
  detectOperationalSignals(lcText, reasons, scores);
  detectRiskReductionSignals(lcText, reasons, scores);

  const correctiveActionBoosted = detectCorrectiveActionBonus(
    lcText,
    reasons,
    scores
  );

  scores.offerStructure = clampScore(scores.offerStructure);
  scores.technicalDepth = clampScore(scores.technicalDepth);
  scores.operationalCredibility = clampScore(scores.operationalCredibility);
  scores.buyerRiskReduction = clampScore(scores.buyerRiskReduction);

  const priorityDimensions = getPriorityDimensions(currentStep);
  let dominantWeakness = getDominantWeakness(scores, priorityDimensions);
  const thresholdForStep = getStepThreshold(currentStep);
  let currentStepScore = getCurrentStepScore(scores, currentStep);
  let didPassStep = currentStepScore >= thresholdForStep;
  let nextStep = getNextStep(currentStep, didPassStep);

  const keywordStuffingDetected = detectKeywordStuffing({
    reasons,
    scores,
    text: lcText,
  });

  if (keywordStuffingDetected) {
    scores.technicalDepth = clampScore(scores.technicalDepth - 1);
    scores.buyerRiskReduction = clampScore(scores.buyerRiskReduction - 1);

    dominantWeakness = "buyerRiskReduction";
    currentStepScore = getCurrentStepScore(scores, currentStep);
    didPassStep = false;
    nextStep = currentStep;

    reasons.push("Multiple claims detected without sufficient supporting detail");
  }

  if (correctiveActionBoosted && currentStep === 4) {
    currentStepScore = getCurrentStepScore(scores, currentStep);

    if (currentStepScore >= thresholdForStep) {
      didPassStep = true;
      nextStep = 5;
      dominantWeakness = getDominantWeakness(scores, priorityDimensions);
    }
  }

  let buyerStyle = computeBuyerStyle(scores);

  if (correctiveActionBoosted && currentStep === 4 && didPassStep) {
    buyerStyle = "analytical";
  }

  if (currentStep === 5 && keywordStuffingDetected) {
    buyerStyle = "strategic";
  }

  if (currentStep === 1 && currentStepScore === 0) {
    buyerStyle = "disqualifying";
  }

  const expectedBuyerReaction = getExpectedBuyerReaction(
    currentStep,
    extractedMemory
  );

  return {
    scores,
    didPassStep,
    nextStep,
    dominantWeakness,
    priorityDimensions,
    buyerStyle,
    expectedBuyerReaction,
    extractedMemory,
    evaluationSignals: {
      keywordStuffingDetected,
    },
    debug: {
      thresholdForStep,
      currentStepScore,
      reasons,
    },
  };
}

export function evaluateAnswer(input: EvaluateAnswerInput): EvaluatorResult {
  return evaluateResponse({
    text: input.userAnswer,
    currentStep: input.currentStep,
    previousScores: input.previousScores,
    conversationMemory: input.conversationMemory,
  });
}