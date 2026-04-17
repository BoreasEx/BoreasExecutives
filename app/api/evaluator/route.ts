import { evaluateResponse } from "@/lib/boreas/evaluator";
import { evaluatorTestCases } from "@/lib/boreas/evaluator.test-cases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EvaluatorTestCase = {
  name: string;
  input: {
    text: string;
    currentStep: 1 | 2 | 3 | 4 | 5;
  };
  expected: unknown;
};

function runEvaluatorTests() {
  return evaluatorTestCases.map((testCase: EvaluatorTestCase) => {
    const output = evaluateResponse(testCase.input);

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
    },
  });
}

export async function POST() {
  const results = runEvaluatorTests();

  return Response.json(results, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}