import { evaluateResponse } from "@/lib/boreas/evaluator";
import { evaluatorTestCases } from "@/lib/boreas/evaluator.test-cases";

type BoreasRouteTestCase = {
  name: string;
  currentStep: 1 | 2 | 3 | 4 | 5;
  sellerMessage: string;
  expected: unknown;
};

function runEvaluatorTests() {
  return (evaluatorTestCases as unknown as BoreasRouteTestCase[]).map((testCase) => {
    const output = evaluateResponse({
      text: testCase.sellerMessage,
      currentStep: testCase.currentStep,
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