import { evaluateAnswer } from "./evaluator";
import {
  evaluatorTestCases,
  type BoreasTestCase,
} from "./evaluator.test-cases";

type TestResult = {
  name: string;
  passed: boolean;
  failures: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compareExtractedMemory(
  actual: unknown,
  expected: BoreasTestCase["expected"]["extractedMemory"]
): string[] {
  const failures: string[] = [];

  if (!expected) return failures;
  if (!isObject(actual)) {
    failures.push("extractedMemory is not an object");
    return failures;
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (actualValue !== expectedValue) {
      failures.push(
        `extractedMemory.${key} expected "${expectedValue}" but got "${String(
          actualValue
        )}"`
      );
    }
  }

  return failures;
}

function compareReasons(
  actualReasons: unknown,
  expectedReasons?: string[]
): string[] {
  const failures: string[] = [];

  if (!expectedReasons || expectedReasons.length === 0) return failures;

  if (!Array.isArray(actualReasons)) {
    failures.push("debug.reasons is not an array");
    return failures;
  }

  for (const expectedReason of expectedReasons) {
    if (!actualReasons.includes(expectedReason)) {
      failures.push(`Missing debug reason "${expectedReason}"`);
    }
  }

  return failures;
}

function runSingleTest(testCase: BoreasTestCase): TestResult {
  const result = evaluateAnswer({
    userAnswer: testCase.userAnswer,
    currentStep: testCase.currentStep,
    previousScores: testCase.previousScores,
    conversationMemory: testCase.conversationMemory,
  });

  const failures: string[] = [];

  if (result.didPassStep !== testCase.expected.didPassStep) {
    failures.push(
      `didPassStep expected ${String(
        testCase.expected.didPassStep
      )} but got ${String(result.didPassStep)}`
    );
  }

  if (result.nextStep !== testCase.expected.nextStep) {
    failures.push(
      `nextStep expected ${String(testCase.expected.nextStep)} but got ${String(
        result.nextStep
      )}`
    );
  }

  if (result.dominantWeakness !== testCase.expected.dominantWeakness) {
    failures.push(
      `dominantWeakness expected "${testCase.expected.dominantWeakness}" but got "${result.dominantWeakness}"`
    );
  }

  if (
    testCase.expected.buyerStyle &&
    result.buyerStyle !== testCase.expected.buyerStyle
  ) {
    failures.push(
      `buyerStyle expected "${testCase.expected.buyerStyle}" but got "${result.buyerStyle}"`
    );
  }

  failures.push(
    ...compareReasons(result.debug.reasons, testCase.expected.mustIncludeReasons)
  );

  failures.push(
    ...compareExtractedMemory(
      result.extractedMemory,
      testCase.expected.extractedMemory
    )
  );

  return {
    name: testCase.name,
    passed: failures.length === 0,
    failures,
  };
}

export function runEvaluatorTests(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results = evaluatorTestCases.map(runSingleTest);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

export function printEvaluatorTestsReport(): void {
  const summary = runEvaluatorTests();

  console.log("=== Boreas Evaluator Test Report ===");
  console.log(
    `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`
  );
  console.log("");

  for (const result of summary.results) {
    if (result.passed) {
      console.log(`PASS ${result.name}`);
      continue;
    }

    console.log(`FAIL ${result.name}`);
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
    console.log("");
  }
}

// Exécution directe locale si besoin
// Vous pouvez commenter ce bloc si vous préférez appeler la fonction ailleurs.
printEvaluatorTestsReport();