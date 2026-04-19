"use client";

import { useEffect } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import { useDataStream } from "./data-stream-provider";

type BoreasScores = {
  offerStructure: number;
  technicalDepth: number;
  operationalCredibility: number;
  buyerRiskReduction: number;
};

type CertificationPayload = {
  status: "fail" | "borderline" | "pass" | "strong_pass";
  scores: BoreasScores;
  verdict: string;
  weaknesses: string[];
};

function isValidCertificationPayload(value: unknown): value is CertificationPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<CertificationPayload>;

  if (
    candidate.status !== "fail" &&
    candidate.status !== "borderline" &&
    candidate.status !== "pass" &&
    candidate.status !== "strong_pass"
  ) {
    return false;
  }

  if (!candidate.scores || typeof candidate.scores !== "object") {
    return false;
  }

  const scores = candidate.scores as Partial<BoreasScores>;

  const scoreValues = [
    scores.offerStructure,
    scores.technicalDepth,
    scores.operationalCredibility,
    scores.buyerRiskReduction,
  ];

  if (!scoreValues.every((value) => typeof value === "number")) {
    return false;
  }

  if (typeof candidate.verdict !== "string") {
    return false;
  }

  if (
    !Array.isArray(candidate.weaknesses) ||
    !candidate.weaknesses.every((item) => typeof item === "string")
  ) {
    return false;
  }

  return true;
}

export function DataStreamHandler() {
  const { dataStream } = useDataStream();
  const { setArtifact } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) return;

    for (const item of dataStream) {
      if (!item || typeof item !== "object" || !("type" in item)) continue;

      switch (item.type) {
        case "data-certification": {
          const payload = "data" in item ? item.data : undefined;

          if (!isValidCertificationPayload(payload)) {
            console.warn("Invalid certification payload ignored", payload);
            continue;
          }

          setArtifact({
            documentId: "certification-result",
            title: "Certification Result",
            kind: "certification",
            status: "idle",
            isVisible: true,
            boundingBox: {
              top: 80,
              left: 0,
              width: 0,
              height: 0,
            },
            content: payload,
          });

          break;
        }

        default:
          break;
      }
    }
  }, [dataStream, setArtifact]);

  return null;
}