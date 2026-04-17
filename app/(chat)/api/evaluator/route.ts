import { evaluateAnswer } from "@/lib/boreas/evaluator";
import { evaluatorTestCases } from "@/lib/boreas/evaluator.test-cases";

export async function POST(req: Request) {
  const body = await req.json();

  const result = evaluateAnswer(body);

  return Response.json(result);
}

export async function GET() {
  const results = evaluatorTestCases.map((test) => {
    const output = evaluateAnswer({
      userAnswer: test.userAnswer,
      currentStep: test.currentStep,
      previousScores: test.previousScores,
      conversationMemory: test.conversationMemory,
    });

    return {
      name: test.name,
      output,
      expected: test.expected,
    };
  });

  return Response.json(results);
}