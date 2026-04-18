import { pdfmetrics } from "reportlab/pdfbase/pdfmetrics";
import { UnicodeCIDFont } from "reportlab/pdfbase/cidfonts";
import {
  SimpleDocTemplate,
  Paragraph,
  Spacer,
} from "reportlab.platypus";
import { getSampleStyleSheet } from "reportlab.lib.styles";

import type { EvaluationReport } from "./generate-report";

// ⚠️ obligatoire pour éviter les problèmes d'encodage
pdfmetrics.registerFont(new UnicodeCIDFont("Helvetica"));

export async function generateBoreasPDF(report: EvaluationReport) {
  const filePath = "/mnt/data/boreas_report.pdf";

  const doc = new SimpleDocTemplate(filePath);
  const styles = getSampleStyleSheet();

  const elements: any[] = [];

  // TITLE
  elements.push(
    new Paragraph("Boreas Evaluation Report", styles["Title"])
  );
  elements.push(Spacer(1, 12));

  // STATUS
  elements.push(
    new Paragraph(`Status: ${report.status.toUpperCase()}`, styles["Heading2"])
  );
  elements.push(Spacer(1, 12));

  // SCORES
  elements.push(new Paragraph("Scores:", styles["Heading3"]));
  elements.push(
    new Paragraph(
      `Offer Structure: ${report.scores.offerStructure}<br/>
       Technical Depth: ${report.scores.technicalDepth}<br/>
       Operational Credibility: ${report.scores.operationalCredibility}<br/>
       Buyer Risk Reduction: ${report.scores.buyerRiskReduction}`,
      styles["Normal"]
    )
  );
  elements.push(Spacer(1, 12));

  // VERDICT
  elements.push(new Paragraph("Verdict:", styles["Heading3"]));
  elements.push(new Paragraph(report.verdict, styles["Normal"]));
  elements.push(Spacer(1, 12));

  // WEAKNESSES
  elements.push(new Paragraph("Key Weaknesses:", styles["Heading3"]));
  report.weaknesses.forEach((w) => {
    elements.push(new Paragraph(`- ${w}`, styles["Normal"]));
  });
  elements.push(Spacer(1, 12));

  // RECOMMENDATIONS
  elements.push(new Paragraph("Recommendations:", styles["Heading3"]));
  report.recommendations.forEach((r) => {
    elements.push(new Paragraph(`- ${r}`, styles["Normal"]));
  });

  doc.build(elements);

  return filePath;
}