"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import {
  artifactDefinitions,
  type CertificationArtifact,
  type UIArtifact,
} from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { getChatHistoryPaginationKey } from "./sidebar-history";

function createEmptyCertificationContent() {
  return {
    status: "borderline" as const,
    scores: {
      offerStructure: 0,
      technicalDepth: 0,
      operationalCredibility: 0,
      buyerRiskReduction: 0,
    },
    verdict: "",
    weaknesses: [],
  };
}

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();
  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = [...dataStream];
    setDataStream([]);

    for (const delta of newDeltas) {
      if (delta.type === "data-chat-title") {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        continue;
      }

      const artifactDefinition = artifactDefinitions.find(
        (currentArtifactDefinition) =>
          currentArtifactDefinition.kind === artifact.kind
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact): UIArtifact => {
        const currentArtifact =
          draftArtifact ?? { ...initialArtifactData, status: "streaming" };

        switch (delta.type) {
          case "data-clear":
            return {
              ...initialArtifactData,
              status: "idle",
            };

          case "data-id":
            return {
              ...currentArtifact,
              documentId: delta.data,
              status: "streaming",
            };

          case "data-title":
            return {
              ...currentArtifact,
              title: delta.data,
              status: "streaming",
            };

          case "data-kind": {
            if (delta.data === "certification") {
              const nextArtifact: CertificationArtifact = {
                title: currentArtifact.title,
                documentId: currentArtifact.documentId,
                kind: "certification",
                content:
                  currentArtifact.kind === "certification"
                    ? currentArtifact.content
                    : createEmptyCertificationContent(),
                isVisible: currentArtifact.isVisible,
                status: "streaming",
                boundingBox: currentArtifact.boundingBox,
              };

              return nextArtifact;
            }

            return {
              ...currentArtifact,
              kind: delta.data,
              status: "streaming",
            };
          }

          case "data-certification": {
            const certificationArtifact: CertificationArtifact = {
              title:
                currentArtifact.title && currentArtifact.title.trim().length > 0
                  ? currentArtifact.title
                  : "Certification Result",
              documentId:
                currentArtifact.documentId || "certification-result",
              kind: "certification",
              status: "idle",
              content: delta.data,
              isVisible: true,
              boundingBox: currentArtifact.boundingBox,
            };

            return certificationArtifact;
          }

          case "data-finish":
            return {
              ...currentArtifact,
              status: "idle",
            };

          default:
            return currentArtifact;
        }
      });
    }
  }, [dataStream, setDataStream, mutate, artifact, setArtifact, setMetadata]);

  return null;
}