import { NextResponse } from "next/server";

/**
 * Mock minimal des fonctions Boreas
 * 👉 Remplacez ces fonctions par vos vraies fonctions importées depuis votre moteur
 */

// Exemple simple de scoring (à remplacer)
function scoreConversation(messages: any[]) {
  let score = 0;

  const lastUserMessage = messages
    .filter((m) => m.role === "user")
    .pop()?.content?.toLowerCase() || "";

  if (lastUserMessage.includes("price")) score++;
  if (lastUserMessage.includes("tons")) score++;
  if (lastUserMessage.includes("egypt")) score++;

  return {
    totalScore: score,
    scores: {
      offerStructure: score,
      technicalDepth: score,
      operationalCredibility: score,
      buyerRiskReduction: score,
    },
  };
}

// Exemple step mapping
function getCurrentStep(totalScore: number) {
  if (totalScore <= 1) return 1;
  if (totalScore === 2) return 2;
  if (totalScore === 3) return 3;
  if (totalScore === 4) return 4;
  return 5;
}

// Détection fin conversation
function isConversationEnded(text: string) {
  if (!text) return false;

  const lower = text.toLowerCase();

  return (
    lower.includes("we will not proceed") ||
    lower.includes("send your final offer") ||
    lower.includes("we can move forward")
  );
}

// Construction certification
function buildCertificationResult(scores: any) {
  const total =
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction;

  let status: "fail" | "borderline" | "pass" | "strong_pass" = "fail";

  if (total >= 10) status = "strong_pass";
  else if (total >= 7) status = "pass";
  else if (total >= 4) status = "borderline";

  return {
    status,
    scores,
    verdict: `Total score: ${total}`,
    weaknesses: ["technicalDepth", "buyerRiskReduction"],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages || [];

    // 🔹 1. scoring
    const { totalScore, scores } = scoreConversation(messages);

    // 🔹 2. step
    const currentStep = getCurrentStep(totalScore);

    // 🔹 3. last assistant message
    const lastAssistantMessage = messages
      .filter((m: any) => m.role === "assistant")
      .pop()?.content;

    // 🔹 4. end detection
    const conversationEnded = isConversationEnded(lastAssistantMessage);

    const shouldTriggerEvaluation =
      currentStep >= 5 && conversationEnded;

    // 🔹 5. certification
    const certificationResult = buildCertificationResult(scores);

    return NextResponse.json({
      ok: true,

      input: {
        messageCount: messages.length,
        lastAssistantMessage,
      },

      debug: {
        totalScore,
        scores,
        currentStep,
        conversationEnded,
        shouldTriggerEvaluation,
        certificationResult,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "chat-debug failed",
      },
      { status: 500 }
    );
  }
}