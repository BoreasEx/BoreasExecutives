"use client";

import type { CertificationContent } from "@/components/chat/artifact";

export const certificationArtifact = {
  kind: "certification" as const,

  actions: [],

  toolbar: [],

  initialize: undefined,

  onStreamPart: undefined,

  content: ({ content }: { content: CertificationContent }) => {
    if (!content) return null;

    return (
      <div className="space-y-6 p-6">
        <h2 className="text-xl font-bold">Certification Result</h2>

        <div className="text-lg">
          Result: <strong>{content.status}</strong>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Scores</h3>
          <ul className="space-y-1">
            <li>Offer Structure: {content.scores.offerStructure}/3</li>
            <li>Technical Depth: {content.scores.technicalDepth}/3</li>
            <li>
              Operational Credibility: {content.scores.operationalCredibility}/3
            </li>
            <li>
              Buyer Risk Reduction: {content.scores.buyerRiskReduction}/3
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Buyer Verdict</h3>
          <p>{content.verdict}</p>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Key Weaknesses</h3>
          <ul className="list-disc pl-5">
            {content.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  },
};