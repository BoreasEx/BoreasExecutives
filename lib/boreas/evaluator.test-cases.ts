import type {
  BoreasScores,
  BuyerStyle,
  ConversationMemory,
  ScoreDimension,
  Step,
} from "./evaluator";

export type BoreasTestCase = {
  name: string;
  currentStep: Step;
  previousScores?: BoreasScores;
  conversationMemory?: ConversationMemory;
  userAnswer: string;
  expected: {
    didPassStep: boolean;
    nextStep: Step;
    dominantWeakness: ScoreDimension;
    buyerStyle?: BuyerStyle;
    mustIncludeReasons?: string[];
    extractedMemory?: ConversationMemory;
  };
};

export const evaluatorTestCases: BoreasTestCase[] = [
  {
    name: "step1_vague_offer",
    currentStep: 1,
    userAnswer: "We offer Egyptian strawberries at competitive prices.",
    expected: {
      didPassStep: false,
      nextStep: 1,
      dominantWeakness: "technicalDepth",
      buyerStyle: "disqualifying",
      mustIncludeReasons: ["Product identified", "Origin identified"],
    },
  },
  {
    name: "step1_structured_offer_pass",
    currentStep: 1,
    userAnswer:
      "IQF strawberries from Egypt, 25-35 mm, Brix 7-9, price 1.85 USD/kg FOB Alexandria, 500 tons available.",
    expected: {
      didPassStep: true,
      nextStep: 2,
      dominantWeakness: "offerStructure",
      buyerStyle: "analytical",
      mustIncludeReasons: [
        "Product identified",
        "Origin identified",
        "Commercial offer structure identified",
        "Brix mentioned",
        "Sizing mentioned",
      ],
      extractedMemory: {
        incoterm: "FOB",
      },
    },
  },
  {
    name: "step1_long_but_empty",
    currentStep: 1,
    userAnswer:
      "We are a serious supplier with strong experience, high commitment, and a professional approach. We can adapt to your requirements and ensure a smooth cooperation with competitive conditions.",
    expected: {
      didPassStep: false,
      nextStep: 1,
      dominantWeakness: "offerStructure",
      buyerStyle: "disqualifying",
    },
  },
  {
    name: "step2_missing_technical_precision",
    currentStep: 2,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 0,
      operationalCredibility: 1,
      buyerRiskReduction: 0,
    },
    userAnswer: "Good quality, nice color, standard packing, industrial grade.",
    expected: {
      didPassStep: false,
      nextStep: 2,
      dominantWeakness: "technicalDepth",
      buyerStyle: "analytical",
    },
  },
  {
    name: "step2_technical_pass",
    currentStep: 2,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 0,
      operationalCredibility: 1,
      buyerRiskReduction: 0,
    },
    userAnswer:
      "Brix 7-9, size 25-35 mm, max 5% defects, packed in 10 kg cartons, IQF process.",
    expected: {
      didPassStep: true,
      nextStep: 3,
      dominantWeakness: "offerStructure",
      buyerStyle: "analytical",
      mustIncludeReasons: ["Brix mentioned", "Sizing mentioned"],
    },
  },
  {
    name: "step4_producer_memory",
    currentStep: 4,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 2,
      operationalCredibility: 1,
      buyerRiskReduction: 0,
    },
    conversationMemory: {
      producerName: "Givrex",
    },
    userAnswer:
      "Givrex uses mechanical tunnel freezing, pre-cooling at 0-4 C, drying, sorting, and lot-based control before shipment.",
    expected: {
      didPassStep: true,
      nextStep: 5,
      dominantWeakness: "operationalCredibility",
      buyerStyle: "analytical",
      extractedMemory: {
        producerName: "Givrex",
      },
    },
  },
  {
    name: "step4_pesticide_incident_with_corrective_action",
    currentStep: 4,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 2,
      operationalCredibility: 1,
      buyerRiskReduction: 0,
    },
    userAnswer:
      "We had one pesticide residue issue in the past. Thanks to lot traceability we identified the farmer, blocked him, and now each lot is tested by SGS Egypt before release.",
    expected: {
      didPassStep: true,
      nextStep: 5,
      dominantWeakness: "operationalCredibility",
      buyerStyle: "analytical",
      mustIncludeReasons: ["Process mentioned"],
    },
  },
  {
    name: "step5_exw_clearly_stated",
    currentStep: 5,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 2,
      operationalCredibility: 2,
      buyerRiskReduction: 0,
    },
    conversationMemory: {
      incoterm: "EXW",
    },
    userAnswer:
      "Our price is 2 USD/kg Ex Works. We can offer replacement in case of confirmed non-conformity.",
    expected: {
      didPassStep: false,
      nextStep: 5,
      dominantWeakness: "buyerRiskReduction",
      buyerStyle: "analytical",
      extractedMemory: {
        incoterm: "EXW",
      },
      mustIncludeReasons: [
        "Commercial offer structure identified",
        "Replacement mentioned",
      ],
    },
  },
  {
    name: "step5_strong_commercial_protection",
    currentStep: 5,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 2,
      operationalCredibility: 2,
      buyerRiskReduction: 0,
    },
    conversationMemory: {
      incoterm: "FOB",
    },
    userAnswer:
      "FOB Alexandria. In case of confirmed non-conformity, we commit to replacement within 5 working days, full insurance coverage, and contractual compensation through credit note.",
    expected: {
      didPassStep: true,
      nextStep: 5,
      dominantWeakness: "operationalCredibility",
      buyerStyle: "strategic",
      extractedMemory: {
        incoterm: "FOB",
      },
      mustIncludeReasons: ["Insurance mentioned", "Replacement mentioned"],
    },
  },
  {
    name: "keyword_stuffing_trap",
    currentStep: 5,
    previousScores: {
      offerStructure: 2,
      technicalDepth: 2,
      operationalCredibility: 1,
      buyerRiskReduction: 0,
    },
    userAnswer:
      "Brix, size, IQF, control, insurance, replacement, FOB, process, tons, quality, conformity, reliability.",
    expected: {
      didPassStep: false,
      nextStep: 5,
      dominantWeakness: "buyerRiskReduction",
    },
  },
];