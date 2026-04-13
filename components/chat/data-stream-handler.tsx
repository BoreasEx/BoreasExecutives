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

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice();
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
        if (!draftArtifact) {
          return { ...initialArtifactData, status: "streaming" };
        }

        switch (delta.type) {
          case "data-id":
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: "streaming",
            };

          case "data-title":
            return {
              ...draftArtifact,
              title: delta.data,
              status: "streaming",
            };

          case "data-kind":
            if (delta.data === "certification") {
              const nextArtifact: CertificationArtifact = {
                title: draftArtifact.title,
                documentId: draftArtifact.documentId,
                kind: "certification",
                content:
                  draftArtifact.kind === "certification"
                    ? draftArtifact.content
                    : {
                        status: "borderline",
                        scores: {
                          offerStructure: 0,
                          technicalDepth: 0,
                          operationalCredibility: 0,
                          buyerRiskReduction: 0,
                        },
                        verdict: "",
                        weaknesses: [],
                      },
                isVisible: draftArtifact.isVisible,
                status: "streaming",
                boundingBox: draftArtifact.boundingBox,
              };

              return nextArtifact;
            }

            return {
              title: draftArtifact.title,
              documentId: draftArtifact.documentId,
              kind: delta.data,
              content:
                draftArtifact.kind === "certification"
                  ? ""
                  : draftArtifact.content,
              isVisible: draftArtifact.isVisible,
              status: "streaming",
              boundingBox: draftArtifact.boundingBox,
            };

          case "data-clear":
            if (draftArtifact.kind === "certification") {
              return draftArtifact;
            }

            return {
              title: draftArtifact.title,
              documentId: draftArtifact.documentId,
              kind: draftArtifact.kind,
              content: "",
              isVisible: draftArtifact.isVisible,
              status: "streaming",
              boundingBox: draftArtifact.boundingBox,
            };

          case "data-finish":
            return {
              ...draftArtifact,
              status: "idle",
            };

          case "data-certification": {
            const certificationArtifact: CertificationArtifact = {
              title: draftArtifact.title,
              documentId: draftArtifact.documentId,
              kind: "certification",
              status: "idle",
              content: delta.data,
              isVisible: true,
              boundingBox: draftArtifact.boundingBox,
            };

            return certificationArtifact;
          }

          default:
            return draftArtifact;
        }
      });
    }
  }, [dataStream, setArtifact, setMetadata, artifact, setDataStream, mutate]);

  return null;
}