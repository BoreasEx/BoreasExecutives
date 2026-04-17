import { evaluateAnswer } from "@/lib/boreas/evaluator";
import {
  evaluatorTestCases,
  type BoreasTestCase,
} from "@/lib/boreas/evaluator.test-cases";

function runEvaluatorTests() {
  return evaluatorTestCases.map((testCase: BoreasTestCase) => {
    const output = evaluateAnswer({
      currentStep: testCase.currentStep,
      previousScores: testCase.previousScores,
      conversationMemory: testCase.conversationMemory,
      userAnswer: testCase.userAnswer,
    });

    return {
      name: testCase.name,
      output,
      expected: testCase.expected,
    };
  });
}

export async function GET() {
  const results = runEvaluatorTests();

  return Response.json(results, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST() {
  const results = runEvaluatorTests();

  return Response.json(results, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}