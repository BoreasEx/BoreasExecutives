import type { EvaluatorResult } from "./evaluator";

export type ReportStatus = "fail" | "borderline" | "pass" | "strong_pass";

export type EvaluationReport = {
  status: ReportStatus;
  scores: EvaluatorResult["scores"];
  verdict: string;
  weaknesses: string[];
  recommendations: string[];
};

function getTotalScore(result: EvaluatorResult): number {
  return (
    result.scores.offerStructure +
    result.scores.technicalDepth +
    result.scores.operationalCredibility +
    result.scores.buyerRiskReduction
  );
}

function computeStatus(result: EvaluatorResult): ReportStatus {
  const total = getTotalScore(result);

  if (!result.didPassStep) return "fail";
  if (total <= 5) return "borderline";
  if (total <= 8) return "pass";
  return "strong_pass";
}

function generateVerdict(result: EvaluatorResult): string {
  if (!result.didPassStep) {
    switch (result.dominantWeakness) {
      case "offerStructure":
        return "Your offer does not yet meet buyer expectations because it remains insufficiently structured.";
      case "technicalDepth":
        return "Your offer does not yet meet buyer expectations because technical precision remains insufficient.";
      case "operationalCredibility":
        return "Your offer does not yet meet buyer expectations because operational reliability is not sufficiently demonstrated.";
      case "buyerRiskReduction":
      default:
        return "Your offer does not yet meet buyer expectations because buyer protection remains insufficient.";
    }
  }

  switch (result.dominantWeakness) {
    case "offerStructure":
      return "Your offer is acceptable, but its commercial structure could be clearer and more immediately convincing.";
    case "technicalDepth":
      return "Your offer is acceptable, but it still lacks technical precision in key areas.";
    case "operationalCredibility":
      return "Your offer is acceptable, but operational credibility could be demonstrated more concretely.";
    case "buyerRiskReduction":
    default:
      return "Your offer is acceptable, but buyer risk reduction is still not fully convincing.";
  }
}

function buildWeaknesses(result: EvaluatorResult): string[] {
  const weaknesses: string[] = [];
  const reasons = result.debug.reasons;

  if (!reasons.includes("Commercial offer structure identified")) {
    weaknesses.push("Commercial structure remains incomplete or insufficiently explicit.");
  }

  if (!reasons.includes("Brix mentioned")) {
    weaknesses.push("Technical specifications remain incomplete, especially on measurable product parameters.");
  }

  if (!reasons.includes("Sizing mentioned")) {
    weaknesses.push("Product sizing is not clearly defined.");
  }

  if (!reasons.includes("Process mentioned")) {
    weaknesses.push("Production or processing steps are not described concretely.");
  }

  if (!reasons.includes("Operational control depth detected")) {
    weaknesses.push("Operational control and traceability are not sufficiently demonstrated.");
  }

  if (!reasons.includes("Insurance mentioned")) {
    weaknesses.push("Insurance or equivalent risk coverage is not clearly stated.");
  }

  if (!reasons.includes("Replacement mentioned")) {
    weaknesses.push("Replacement or compensation terms are not clearly defined.");
  }

  if (result.evaluationSignals.keywordStuffingDetected) {
    weaknesses.push(
      "Several relevant points were mentioned, but too many claims remained insufficiently supported."
    );
  }

  if (weaknesses.length === 0) {
    switch (result.dominantWeakness) {
      case "offerStructure":
        weaknesses.push("Commercial structuring could still be improved.");
        break;
      case "technicalDepth":
        weaknesses.push("Technical precision could still be improved.");
        break;
      case "operationalCredibility":
        weaknesses.push("Operational credibility could still be reinforced.");
        break;
      case "buyerRiskReduction":
        weaknesses.push("Buyer protection could still be made more concrete.");
        break;
    }
  }

  return weaknesses.slice(0, 4);
}

function buildRecommendations(result: EvaluatorResult): string[] {
  const recommendations: string[] = [];

  switch (result.dominantWeakness) {
    case "offerStructure":
      recommendations.push(
        "State the offer in one clear line: product, origin, price basis, and available volume."
      );
      recommendations.push(
        "Use a more explicit commercial format before adding supporting details."
      );
      break;

    case "technicalDepth":
      recommendations.push(
        "Add precise technical specifications such as Brix, size range, defects, and packing."
      );
      recommendations.push(
        "Use measurable product data rather than general quality statements."
      );
      break;

    case "operationalCredibility":
      recommendations.push(
        "Describe your process and quality control system step by step."
      );
      recommendations.push(
        "Add traceability, batch control, and laboratory verification details."
      );
      break;

    case "buyerRiskReduction":
      recommendations.push(
        "Clarify insurance, replacement, compensation, and non-conformity handling terms."
      );
      recommendations.push(
        "Explain what concrete protections remain in place for the buyer."
      );
      break;
  }

  if (result.evaluationSignals.keywordStuffingDetected) {
    recommendations.push(
      "Replace dense claim stacking with fewer, more concrete, measurable, and verifiable points."
    );
  }

  return recommendations.slice(0, 4);
}

export function generateEvaluationReport(
  result: EvaluatorResult
): EvaluationReport {
  return {
    status: computeStatus(result),
    scores: result.scores,
    verdict: generateVerdict(result),
    weaknesses: buildWeaknesses(result),
    recommendations: buildRecommendations(result),
  };
}