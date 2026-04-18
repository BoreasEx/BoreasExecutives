import { CertificationPanel } from "@/components/boreas/certification-panel";
import { generateEvaluationReport } from "@/lib/boreas/generate-report";
import { evaluateAnswer } from "@/lib/boreas/evaluator";

export default function CertificationPreviewPage() {
  const evaluation = evaluateAnswer({
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
  });

  const report = generateEvaluationReport(evaluation);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <CertificationPanel report={report} />
    </main>
  );
}