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
  1: ["offerStructure"],
  2: ["technicalDepth", "offerStructure"],
  3: ["operationalCredibility", "technicalDepth"],
  4: ["operationalCredibility", "technicalDepth"],
  5: ["buyerRiskReduction", "operationalCredibility"],
};

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
    text.match(/producer called\s+([a-z0-9&.\- ]+)/i) ||
    text.match(/processor called\s+([a-z0-9&.\- ]+)/i);

  if (producerMatch?.[1]) {
    memory.producerName = producerMatch[1].trim();
  }

  if (/\bex works\b|\bexw\b/.test(text)) {
    memory.incoterm = "EXW";
  } else if (/\bfob\b/.test(text)) {
    memory.incoterm = "FOB";
  } else if (/\bcif\b/.test(text)) {
    memory.incoterm = "CIF";
  }

  if (/egyptian jurisdiction/.test(text)) {
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

  let offerStructure = 0;
  let technicalDepth = 0;
  let operationalCredibility = 0;
  let buyerRiskReduction = 0;

  // OFFER STRUCTURE
  if (text.includes("strawberry")) {
    offerStructure++;
    reasons.push("Product identified");
  }
  if (text.includes("egypt")) {
    offerStructure++;
    reasons.push("Origin identified");
  }
  if (/\b\d+\s?(usd|€|eur)/.test(text)) {
    offerStructure++;
    reasons.push("Price identified");
  }

  // TECHNICAL
  if (text.includes("brix")) {
    technicalDepth++;
    reasons.push("Brix mentioned");
  }
  if (text.includes("mm") || text.includes("size")) {
    technicalDepth++;
    reasons.push("Sizing mentioned");
  }

  // OPERATIONAL
  if (text.includes("ton") || text.includes("container")) {
    operationalCredibility++;
    reasons.push("Volume or shipment mentioned");
  }
  if (text.includes("process") || text.includes("control")) {
    operationalCredibility++;
    reasons.push("Process mentioned");
  }

  // RISK
  if (text.includes("insurance")) {
    buyerRiskReduction++;
    reasons.push("Insurance mentioned");
  }
  if (text.includes("replacement")) {
    buyerRiskReduction++;
    reasons.push("Replacement mentioned");
  }

  return {
    scores: {
      offerStructure: Math.min(offerStructure, 3),
      technicalDepth: Math.min(technicalDepth, 3),
      operationalCredibility: Math.min(operationalCredibility, 3),
      buyerRiskReduction: Math.min(buyerRiskReduction, 3),
    },
    reasons,
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

function getCurrentStepScore(
  scores: BoreasScores,
  step: Step
): number {
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
  return dims.sort((a, b) => scores[a] - scores[b])[0];
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
  weakness: ScoreDimension
) {
  const tone = {
    offerStructure: "Your offer remains unclear and incomplete.",
    technicalDepth: "Technical precision is insufficient.",
    operationalCredibility: "Operational reliability is not demonstrated.",
    buyerRiskReduction: "Risk coverage is not acceptable.",
  };

  const questions: Record<Step, string> = {
    1: "Present your offer clearly with product, price, and volume.",
    2: "Detail technical specs: Brix, sizing, defects.",
    3: "Explain your consistency from lot to lot.",
    4: "Describe your production and quality control system.",
    5: "Explain why this supply is commercially reliable.",
  };

  return {
    toneLine: tone[weakness],
    questionLine: questions[step],
  };
}

// =====================
// MAIN FUNCTION
// =====================

export function evaluateAnswer(
  input: EvaluatorInput
): EvaluatorOutput {
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
    didPass && currentStep < 5 ? (currentStep + 1) as Step : currentStep;

  const dominantWeakness = getDominantWeakness(scores, currentStep);

  const buyerStyle = getBuyerStyle(scores);

  const reaction = buildExpectedBuyerReaction(
    currentStep,
    dominantWeakness
  );

  return {
    scores,
    didPassStep: didPass,
    nextStep,
    dominantWeakness,
    priorityDimensions: getPriorityDimensions(currentStep),
    buyerStyle,
    expectedBuyerReaction: reaction,
    extractedMemory,
    debug: {
      thresholdForStep: STEP_THRESHOLDS[currentStep],
      currentStepScore: getCurrentStepScore(scores, currentStep),
      reasons,
    },
  };
}