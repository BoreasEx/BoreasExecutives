// =====================
// TYPES
// =====================

export type Step = 1 | 2 | 3 | 4 | 5;

export type ScoreDimension =
  | "offerStructure"
  | "technicalDepth"
  | "operationalCredibility"
  | "buyerRiskReduction";

export type BuyerStyle = "disqualifying" | "analytical" | "strategic";

export type BoreasScores = {
  offerStructure: number;
  technicalDepth: number;
  operationalCredibility: number;
  buyerRiskReduction: number;
};

export type ConversationMemory = {
  producerName?: string;
  incoterm?: string;
  jurisdiction?: string;
};

export type EvaluatorInput = {
  userAnswer: string;
  currentStep: Step;
  previousScores?: BoreasScores;
  conversationMemory?: ConversationMemory;
};

export type EvaluatorOutput = {
  scores: BoreasScores;
  didPassStep: boolean;
  nextStep: Step;
  dominantWeakness: ScoreDimension;
  priorityDimensions: ScoreDimension[];
  buyerStyle: BuyerStyle;
  expectedBuyerReaction: {
    toneLine: string;
    questionLine: string;
    objectionLine?: string;
  };
  extractedMemory: ConversationMemory;
  debug: {
    thresholdForStep: number;
    currentStepScore: number;
    reasons: string[];
  };
};

// =====================
// CONSTANTS
// =====================

const STEP_THRESHOLDS: Record<Step, number> = {
  1: 2,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
};

const STEP_PRIORITY: Record<Step, ScoreDimension[]> = {
  1: ["offerStructure", "technicalDepth"],
  2: ["technicalDepth", "offerStructure"],
  3: ["operationalCredibility", "technicalDepth"],
  4: ["operationalCredibility", "technicalDepth"],
  5: ["buyerRiskReduction", "operationalCredibility"],
};

const RECOGNIZED_LABS = [
  "sgs egypt",
  "sgs",
  "agq labs egypt",
  "agq labs",
  "agq",
  "zi-7 food testing lab",
  "zi-7",
  "zi 7",
  "zi7",
  "food testing lab",
];

// =====================
// HELPERS
// =====================

function clampScore(value: number): number {
  return Math.max(0, Math.min(3, value));
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

function hasAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function countHits(text: string, signals: string[]): number {
  return signals.filter((signal) => text.includes(signal)).length;
}

function isKeywordStuffing(text: string): boolean {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const commaCount = (trimmed.match(/,/g) || []).length;

  const hasVerb =
    /\b(is|are|have|has|commit|offer|offers|provide|provides|guarantee|guarantees|test|tests|tested|block|blocks|replace|replaces|release|releases|ship|ships|control|controls|check|checks|explain|confirm)\b/.test(
      trimmed
    );

  const keywordSignals = [
    "brix",
    "iqf",
    "insurance",
    "replacement",
    "fob",
    "process",
    "tons",
    "quality",
    "conformity",
    "reliability",
    "size",
    "control",
  ];

  const keywordHits = keywordSignals.filter((signal) =>
    trimmed.includes(signal)
  ).length;

  const hasSentenceStructure = /[.?!]/.test(trimmed);
  const hasConnector =
    /\b(and|with|because|therefore|which|that|before|after|under|in case)\b/.test(
      trimmed
    );

  return (
    keywordHits >= 6 &&
    wordCount <= 20 &&
    (!hasVerb || (!hasSentenceStructure && !hasConnector)) &&
    commaCount >= 3
  );
}

// =====================
// MEMORY EXTRACTION
// =====================

function extractMemory(
  userAnswer: string,
  previous?: ConversationMemory
): ConversationMemory {
  const text = userAnswer.toLowerCase();
  const memory: ConversationMemory = { ...previous };

  const producerMatch =
    userAnswer.match(/producer called\s+([A-Za-z0-9&.\- ]{2,60})/i) ||
    userAnswer.match(/processor called\s+([A-Za-z0-9&.\- ]{2,60})/i) ||
    userAnswer.match(/producer is\s+([A-Za-z0-9&.\- ]{2,60})/i) ||
    userAnswer.match(/processor is\s+([A-Za-z0-9&.\- ]{2,60})/i);

  if (producerMatch?.[1]) {
    memory.producerName = producerMatch[1].trim();
  }

  if (/\bex works\b|\bexw\b/i.test(text)) {
    memory.incoterm = "EXW";
  } else if (/\bfob\b/i.test(text)) {
    memory.incoterm = "FOB";
  } else if (/\bcif\b/i.test(text)) {
    memory.incoterm = "CIF";
  }

  if (
    /egyptian jurisdiction|jurisdiction is egyptian|governed by egyptian law/i.test(
      text
    )
  ) {
    memory.jurisdiction = "Egyptian";
  }

  return memory;
}

// =====================
// SCORING
// =====================

function scoreAnswer(userAnswer: string): {
  scores: BoreasScores;
  reasons: string[];
} {
  const text = userAnswer.toLowerCase();
  const reasons: string[] = [];

  if (isKeywordStuffing(text)) {
    reasons.push("Keyword stuffing detected");
    return {
      scores: {
        offerStructure: 0,
        technicalDepth: 0,
        operationalCredibility: 0,
        buyerRiskReduction: 0,
      },
      reasons,
    };
  }

  let offerStructure = 0;
  let technicalDepth = 0;
  let operationalCredibility = 0;
  let buyerRiskReduction = 0;

  // ---------------------
  // OFFER STRUCTURE
  // ---------------------

  const hasProduct =
    /\bstrawberry\b|\bstrawberries\b/.test(text) ||
    /\biqf strawberry\b|\biqf strawberries\b/.test(text);

  const hasOrigin = /\begypt\b|\begyptian\b/.test(text);

  const hasPrice =
    /\b\d+(?:[.,]\d+)?\s?(usd|eur|€|\$)(?:\/kg| per kg)?\b/.test(text) ||
    /\bprice\b/.test(text);

  const hasVolume =
    /\b\d+\s?(tons|ton|containers|container)\b/.test(text) ||
    /\bavailable\b/.test(text);

  const hasCommercialBasis =
    /\bex works\b|\bexw\b|\bfob\b|\bcif\b/i.test(text);

  if (hasProduct) {
    offerStructure++;
    reasons.push("Product identified");
  }

  if (hasOrigin) {
    offerStructure++;
    reasons.push("Origin identified");
  }

  if (hasPrice || hasVolume || hasCommercialBasis) {
    offerStructure++;
    reasons.push("Commercial offer structure identified");
  }

  // ---------------------
  // TECHNICAL DEPTH
  // ---------------------

  const hasBrix = /\bbrix\b/.test(text);

  const hasSizing =
    /\b\d{1,3}\s?-\s?\d{1,3}\s?(mm|cm)\b/.test(text) ||
    /\b\d{1,3}\s?(mm|cm)\b/.test(text) ||
    /\b\d{1,3}\s?x\s?\d{1,3}\s?(mm|cm)\b/.test(text) ||
    /\bdiced\b/.test(text) ||
    /\bcube\b|\bcubes\b/.test(text);

  const hasDefectOrPackSignals =
    /\bdefect\b|\bdefects\b|\btolerance\b|\bbroken\b|\bpacking\b|\bpacked\b|\bcarton\b|\bcartons\b|\bvariety\b|\biqf\b/.test(
      text
    );

  if (hasBrix) {
    technicalDepth++;
    reasons.push("Brix mentioned");
  }

  if (hasSizing) {
    technicalDepth++;
    reasons.push("Sizing mentioned");
  }

  if (hasDefectOrPackSignals) {
    technicalDepth++;
    reasons.push("Technical specs mentioned");
  }

  // ---------------------
  // OPERATIONAL CREDIBILITY
  // ---------------------

  const volumeSignals = [
    "ton",
    "tons",
    "container",
    "containers",
    "shipment",
    "shipments",
  ];

  const processSignals = [
    "process",
    "processing",
    "control",
    "controls",
    "sorting",
    "pre-cooling",
    "precooling",
    "tunnel",
    "mechanical tunnel",
    "drying",
    "single-layer feeding",
    "single layer feeding",
    "lot",
    "traceability",
    "pre-shipment",
    "pre shipment",
  ];

  const operationalHits =
    countHits(text, volumeSignals) + countHits(text, processSignals);

  if (hasAny(text, volumeSignals) || hasAny(text, processSignals)) {
    operationalCredibility++;
    reasons.push("Process mentioned");
  }

  if (operationalHits >= 3) {
    operationalCredibility++;
    reasons.push("Operational control depth detected");
  }

  if (/\bproducer\b|\bprocessor\b|\bfactory\b|\bfacility\b/.test(text)) {
    operationalCredibility++;
    reasons.push("Production setup mentioned");
  }

  // ---------------------
  // BUYER RISK REDUCTION
  // ---------------------

  const hasInsurance = /\binsurance\b|\binsured\b/.test(text);

  const hasReplacement =
    /\breplacement\b|\breplace\b|\breplaced\b/.test(text);

  const hasCompensation =
    /\bcredit note\b|\bcompensation\b|\bliability\b|\bpenalty\b/.test(text);

  const hasTestingAction =
    /\btested\b|\btest\b|\btesting\b|\banalysis\b|\blaboratory\b|\beach lot\b|\bbefore shipment\b|\brelease\b|\breleased\b/.test(
      text
    );

  const hasRecognizedLab = RECOGNIZED_LABS.some((lab) => text.includes(lab));

  const hasPesticideControl =
    /\bpesticide\b|\bpesticides\b|\bresidue\b|\bresidues\b/.test(text);

  if (hasInsurance) {
    buyerRiskReduction++;
    reasons.push("Insurance mentioned");
  }

  if (hasReplacement) {
    buyerRiskReduction++;
    reasons.push("Replacement mentioned");
  }

  if (hasRecognizedLab) {
    buyerRiskReduction++;
    reasons.push("Recognized lab mentioned");
  }

  if (hasTestingAction || hasCompensation || hasPesticideControl) {
    buyerRiskReduction++;
    reasons.push("Compliance control mentioned");
  }

  if (hasRecognizedLab && (hasTestingAction || hasPesticideControl)) {
    buyerRiskReduction++;
    reasons.push("Structured lab testing process");
  }

  return {
    scores: {
      offerStructure: clampScore(offerStructure),
      technicalDepth: clampScore(technicalDepth),
      operationalCredibility: clampScore(operationalCredibility),
      buyerRiskReduction: clampScore(buyerRiskReduction),
    },
    reasons: uniqueReasons(reasons),
  };
}

// =====================
// SCORE MERGE
// =====================

function mergeScores(
  previous: BoreasScores | undefined,
  current: BoreasScores
): BoreasScores {
  if (!previous) return current;

  return {
    offerStructure: Math.max(previous.offerStructure, current.offerStructure),
    technicalDepth: Math.max(previous.technicalDepth, current.technicalDepth),
    operationalCredibility: Math.max(
      previous.operationalCredibility,
      current.operationalCredibility
    ),
    buyerRiskReduction: Math.max(
      previous.buyerRiskReduction,
      current.buyerRiskReduction
    ),
  };
}

// =====================
// STEP LOGIC
// =====================

function getPriorityDimensions(step: Step): ScoreDimension[] {
  return STEP_PRIORITY[step];
}

function getCurrentStepScore(scores: BoreasScores, step: Step): number {
  const dims = getPriorityDimensions(step);
  return Math.min(...dims.map((d) => scores[d]));
}

function didPassStep(scores: BoreasScores, step: Step): boolean {
  return getCurrentStepScore(scores, step) >= STEP_THRESHOLDS[step];
}

// =====================
// WEAKNESS & STYLE
// =====================

function getDominantWeakness(
  scores: BoreasScores,
  step: Step
): ScoreDimension {
  const dims = getPriorityDimensions(step);

  return dims.reduce((weakest, current) => {
    if (scores[current] < scores[weakest]) {
      return current;
    }
    return weakest;
  }, dims[0]);
}

function getBuyerStyle(scores: BoreasScores): BuyerStyle {
  const total =
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction;

  if (total <= 3) return "disqualifying";
  if (total <= 7) return "analytical";
  return "strategic";
}

// =====================
// BUYER REACTION
// =====================

function buildExpectedBuyerReaction(
  step: Step,
  weakness: ScoreDimension,
  memory: ConversationMemory
): {
  toneLine: string;
  questionLine: string;
  objectionLine?: string;
} {
  const toneMap: Record<ScoreDimension, string> = {
    offerStructure: "Your offer remains unclear and incomplete.",
    technicalDepth: "Technical precision is insufficient.",
    operationalCredibility: "Operational reliability is not demonstrated.",
    buyerRiskReduction: "Risk coverage is not acceptable.",
  };

  let questionLine = "";

  if (step === 1) {
    questionLine =
      "Present your offer clearly with product, origin, price basis, and available volume.";
  } else if (step === 2) {
    questionLine =
      "Detail technical specs: Brix, sizing, defects, packing, and product format.";
  } else if (step === 3) {
    questionLine =
      "Explain how you ensure consistency from lot to lot and across shipped volumes.";
  } else if (step === 4) {
    questionLine = memory.producerName
      ? `The producer ${memory.producerName} is noted. Describe your production and quality control system in concrete terms.`
      : "Describe your production and quality control system.";
  } else if (step === 5) {
    questionLine =
      memory.incoterm === "EXW"
        ? "Your Ex Works position is understood. Explain what concrete protections, compensation terms, and risk-mitigation mechanisms you offer despite that structure."
        : "Explain why this supply is commercially reliable and what concrete guarantees protect the buyer.";
  }

  return {
    toneLine: toneMap[weakness],
    questionLine,
  };
}

// =====================
// MAIN FUNCTION
// =====================

export function evaluateAnswer(input: EvaluatorInput): EvaluatorOutput {
  const {
    userAnswer,
    currentStep,
    previousScores,
    conversationMemory,
  } = input;

  const extractedMemory = extractMemory(userAnswer, conversationMemory);
  const { scores: rawScores, reasons } = scoreAnswer(userAnswer);
  const scores = mergeScores(previousScores, rawScores);
  const didPass = didPassStep(scores, currentStep);

  const nextStep =
    didPass && currentStep < 5 ? ((currentStep + 1) as Step) : currentStep;

  const dominantWeakness = getDominantWeakness(scores, currentStep);
  const buyerStyle = getBuyerStyle(scores);

  const expectedBuyerReaction = buildExpectedBuyerReaction(
    currentStep,
    dominantWeakness,
    extractedMemory
  );

  return {
    scores,
    didPassStep: didPass,
    nextStep,
    dominantWeakness,
    priorityDimensions: getPriorityDimensions(currentStep),
    buyerStyle,
    expectedBuyerReaction,
    extractedMemory,
    debug: {
      thresholdForStep: STEP_THRESHOLDS[currentStep],
      currentStepScore: getCurrentStepScore(scores, currentStep),
      reasons,
    },
  };
}