import type { EvaluationReport } from "@/lib/boreas/generate-report";
import { ScoreCard } from "./score-card";
import { StatusBadge } from "./status-badge";

type CertificationPanelProps = {
  report: EvaluationReport;
  title?: string;
};

export function CertificationPanel({
  report,
  title = "Boreas Evaluation",
}: CertificationPanelProps) {
  return (
    <section className="w-full rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Certification
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Final buyer-side assessment based on the negotiation quality, technical depth,
            operational credibility, and buyer risk protection.
          </p>
        </div>

        <StatusBadge status={report.status} />
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:p-5">
        <div className="text-sm font-medium text-zinc-500">Verdict</div>
        <p className="mt-2 text-base font-medium leading-7 text-zinc-900">
          {report.verdict}
        </p>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-sm font-medium text-zinc-500">Scores</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScoreCard
            label="Offer Structure"
            value={report.scores.offerStructure}
          />
          <ScoreCard
            label="Technical Depth"
            value={report.scores.technicalDepth}
          />
          <ScoreCard
            label="Operational Credibility"
            value={report.scores.operationalCredibility}
          />
          <ScoreCard
            label="Buyer Risk Reduction"
            value={report.scores.buyerRiskReduction}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-medium text-zinc-500">Key Weaknesses</div>
          <ul className="mt-3 space-y-3">
            {report.weaknesses.length > 0 ? (
              report.weaknesses.map((weakness) => (
                <li
                  key={weakness}
                  className="rounded-xl bg-zinc-50 px-3 py-3 text-sm leading-6 text-zinc-700"
                >
                  {weakness}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">No major weakness detected.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-medium text-zinc-500">Recommendations</div>
          <ul className="mt-3 space-y-3">
            {report.recommendations.length > 0 ? (
              report.recommendations.map((recommendation) => (
                <li
                  key={recommendation}
                  className="rounded-xl bg-zinc-50 px-3 py-3 text-sm leading-6 text-zinc-700"
                >
                  {recommendation}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">No recommendation available.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}