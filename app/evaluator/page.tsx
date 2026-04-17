"use client";

import { useEffect, useMemo, useState } from "react";

type Scores = {
  offerStructure: number;
  technicalDepth: number;
  operationalCredibility: number;
  buyerRiskReduction: number;
};

type BuyerStyle = "disqualifying" | "analytical" | "strategic" | string;

type EvaluatorOutput = {
  scores: Scores;
  didPassStep: boolean;
  nextStep: number;
  dominantWeakness: string;
  priorityDimensions?: string[];
  buyerStyle: BuyerStyle;
  expectedBuyerReaction?: {
    toneLine?: string;
    questionLine?: string;
  };
  extractedMemory?: Record<string, string>;
  debug?: {
    thresholdForStep?: number;
    currentStepScore?: number;
    reasons?: string[];
  };
};

type EvaluatorExpected = {
  didPassStep?: boolean;
  nextStep?: number;
  dominantWeakness?: string;
  buyerStyle?: BuyerStyle;
  mustIncludeReasons?: string[];
  extractedMemory?: Record<string, string>;
};

type TestCaseResult = {
  name: string;
  output: EvaluatorOutput;
  expected: EvaluatorExpected;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function prettyLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function compareObjects(
  actual: Record<string, string> = {},
  expected: Record<string, string> = {}
) {
  const mismatches: string[] = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (actualValue !== expectedValue) {
      mismatches.push(
        `${key}: expected "${expectedValue}", got "${actualValue ?? "undefined"}"`
      );
    }
  }

  return mismatches;
}

function compareReasons(actual: string[] = [], expected: string[] = []) {
  const missing: string[] = [];

  for (const reason of expected) {
    if (!actual.includes(reason)) {
      missing.push(reason);
    }
  }

  return missing;
}

function getDiffs(test: TestCaseResult) {
  const diffs: string[] = [];
  const { output, expected } = test;

  if (
    typeof expected.didPassStep === "boolean" &&
    output.didPassStep !== expected.didPassStep
  ) {
    diffs.push(
      `didPassStep: expected ${String(expected.didPassStep)}, got ${String(output.didPassStep)}`
    );
  }

  if (
    typeof expected.nextStep === "number" &&
    output.nextStep !== expected.nextStep
  ) {
    diffs.push(`nextStep: expected ${expected.nextStep}, got ${output.nextStep}`);
  }

  if (
    expected.dominantWeakness &&
    output.dominantWeakness !== expected.dominantWeakness
  ) {
    diffs.push(
      `dominantWeakness: expected "${expected.dominantWeakness}", got "${output.dominantWeakness}"`
    );
  }

  if (expected.buyerStyle && output.buyerStyle !== expected.buyerStyle) {
    diffs.push(
      `buyerStyle: expected "${expected.buyerStyle}", got "${output.buyerStyle}"`
    );
  }

  const memoryDiffs = compareObjects(
    output.extractedMemory ?? {},
    expected.extractedMemory ?? {}
  );
  diffs.push(...memoryDiffs.map((d) => `extractedMemory.${d}`));

  const missingReasons = compareReasons(
    output.debug?.reasons ?? [],
    expected.mustIncludeReasons ?? []
  );
  diffs.push(...missingReasons.map((reason) => `Missing reason: "${reason}"`));

  return diffs;
}

function sumScores(scores: Scores) {
  return (
    scores.offerStructure +
    scores.technicalDepth +
    scores.operationalCredibility +
    scores.buyerRiskReduction
  );
}

function getCriticality(test: TestCaseResult, diffs: string[]) {
  if (test.name === "keyword_stuffing_trap" && diffs.length > 0) {
    return "critical";
  }

  if (diffs.length === 0) {
    return "ok";
  }

  if (
    test.name.includes("pesticide") ||
    diffs.some((d) => d.includes("didPassStep")) ||
    diffs.some((d) => d.includes("buyerStyle"))
  ) {
    return "major";
  }

  return "minor";
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "yellow" | "blue" | "neutral";
}) {
  const styles = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-red-100 text-red-800 border-red-200",
    yellow: "bg-amber-100 text-amber-800 border-amber-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    neutral: "bg-zinc-100 text-zinc-800 border-zinc-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[tone]
      )}
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900">{value}</div>
      {sublabel ? <div className="mt-1 text-xs text-zinc-500">{sublabel}</div> : null}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const width = Math.max(0, Math.min(100, (value / 3) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600">{prettyLabel(label)}</span>
        <span className="font-medium text-zinc-900">{value}/3</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-zinc-900 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function TestCaseCard({ test }: { test: TestCaseResult }) {
  const diffs = getDiffs(test);
  const criticality = getCriticality(test, diffs);
  const totalScore = sumScores(test.output.scores);

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        criticality === "critical" && "border-red-300 bg-red-50/60",
        criticality === "major" && "border-amber-300 bg-amber-50/60",
        criticality === "minor" && "border-blue-200 bg-blue-50/50",
        criticality === "ok" && "border-zinc-200 bg-white"
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">{test.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge tone={diffs.length === 0 ? "green" : "red"}>
              {diffs.length === 0 ? "PASS" : "FAIL"}
            </StatusBadge>

            <StatusBadge tone="neutral">
              Step {test.output.nextStep}
            </StatusBadge>

            <StatusBadge
              tone={
                test.output.buyerStyle === "strategic"
                  ? "blue"
                  : test.output.buyerStyle === "analytical"
                    ? "yellow"
                    : "neutral"
              }
            >
              {test.output.buyerStyle}
            </StatusBadge>

            {test.name === "keyword_stuffing_trap" ? (
              <StatusBadge tone="red">Critical watchpoint</StatusBadge>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-right">
          <div className="text-xs text-zinc-500">Total score</div>
          <div className="text-xl font-semibold text-zinc-900">{totalScore}/12</div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Scores</div>
          <ScoreBar label="offerStructure" value={test.output.scores.offerStructure} />
          <ScoreBar label="technicalDepth" value={test.output.scores.technicalDepth} />
          <ScoreBar
            label="operationalCredibility"
            value={test.output.scores.operationalCredibility}
          />
          <ScoreBar
            label="buyerRiskReduction"
            value={test.output.scores.buyerRiskReduction}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Output summary</div>
          <div className="grid gap-2 text-sm text-zinc-700">
            <div>
              <span className="font-medium text-zinc-900">didPassStep:</span>{" "}
              {String(test.output.didPassStep)}
            </div>
            <div>
              <span className="font-medium text-zinc-900">dominantWeakness:</span>{" "}
              {test.output.dominantWeakness}
            </div>
            <div>
              <span className="font-medium text-zinc-900">thresholdForStep:</span>{" "}
              {test.output.debug?.thresholdForStep ?? "—"}
            </div>
            <div>
              <span className="font-medium text-zinc-900">currentStepScore:</span>{" "}
              {test.output.debug?.currentStepScore ?? "—"}
            </div>
          </div>

          {test.output.expectedBuyerReaction ? (
            <div className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
              <div>
                <span className="font-medium text-zinc-900">Tone:</span>{" "}
                {test.output.expectedBuyerReaction.toneLine ?? "—"}
              </div>
              <div className="mt-2">
                <span className="font-medium text-zinc-900">Question:</span>{" "}
                {test.output.expectedBuyerReaction.questionLine ?? "—"}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Detected reasons</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(test.output.debug?.reasons ?? []).length > 0 ? (
              test.output.debug?.reasons?.map((reason) => (
                <StatusBadge key={reason} tone="blue">
                  {reason}
                </StatusBadge>
              ))
            ) : (
              <span className="text-sm text-zinc-500">No reasons detected</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">Extracted memory</div>
          <div className="mt-3 text-sm text-zinc-700">
            {test.output.extractedMemory &&
            Object.keys(test.output.extractedMemory).length > 0 ? (
              <pre className="overflow-x-auto rounded-xl bg-zinc-50 p-3 text-xs text-zinc-800">
                {JSON.stringify(test.output.extractedMemory, null, 2)}
              </pre>
            ) : (
              <span className="text-zinc-500">No memory extracted</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Expected vs actual</div>

        {diffs.length === 0 ? (
          <div className="mt-3 text-sm text-green-700">
            No mismatch detected. Output is aligned with expected result.
          </div>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {diffs.map((diff) => (
              <li
                key={diff}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800"
              >
                {diff}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function EvaluatorPage() {
  const [data, setData] = useState<TestCaseResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/evaluator", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }

        const json = await res.json();

        if (!cancelled) {
          if (Array.isArray(json)) {
            setData(json);
          } else if (Array.isArray(json.results)) {
            setData(json.results);
          } else {
            throw new Error("Unexpected API response format");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unknown error while loading evaluator results"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const tests = data ?? [];
    const evaluated = tests.map((test) => ({
      test,
      diffs: getDiffs(test),
    }));

    const passed = evaluated.filter((item) => item.diffs.length === 0).length;
    const failed = evaluated.filter((item) => item.diffs.length > 0).length;

    const criticalFailures = evaluated.filter(
      (item) => getCriticality(item.test, item.diffs) === "critical"
    ).length;

    const majorFailures = evaluated.filter(
      (item) => getCriticality(item.test, item.diffs) === "major"
    ).length;

    const keywordStuffing = evaluated.find(
      (item) => item.test.name === "keyword_stuffing_trap"
    );

    const v1Stable =
      failed === 0 ||
      (failed === 1 &&
        keywordStuffing &&
        keywordStuffing.diffs.length === 0 &&
        criticalFailures === 0);

    return {
      total: tests.length,
      passed,
      failed,
      criticalFailures,
      majorFailures,
      v1Stable:
        tests.length > 0 &&
        failed === 0 &&
        criticalFailures === 0 &&
        majorFailures === 0,
      keywordStuffingFailed: Boolean(
        keywordStuffing && keywordStuffing.diffs.length > 0
      ),
    };
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-zinc-500">Boreas Evaluator</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Loading evaluator results...
            </h1>
            <div className="mt-6 h-2 w-48 animate-pulse rounded-full bg-zinc-200" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-red-600">Boreas Evaluator</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              Unable to load evaluator results
            </h1>
            <p className="mt-4 text-sm text-zinc-600">
              {error ?? "No data returned by /api/evaluator"}
            </p>
            <div className="mt-6 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
              Check that your preview exposes <code>/api/evaluator</code> and returns
              either:
              <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs">
{`[
  { "name": "...", "output": {...}, "expected": {...} }
]`}
              </pre>
              or
              <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs">
{`{ "results": [ ... ] }`}
              </pre>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.12em] text-zinc-500">
                Boreas Evaluator
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                Evaluator test review
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                Deterministic scoring engine validation for Boreas. This page compares
                actual evaluator output against expected business outcomes and highlights
                the remaining gaps before V1 stabilization.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={summary.v1Stable ? "green" : "red"}>
                {summary.v1Stable ? "V1 stable" : "V1 not stable"}
              </StatusBadge>

              {summary.keywordStuffingFailed ? (
                <StatusBadge tone="red">Keyword stuffing not blocked</StatusBadge>
              ) : (
                <StatusBadge tone="green">Keyword stuffing controlled</StatusBadge>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total tests" value={summary.total} />
            <MetricCard label="Passing" value={summary.passed} />
            <MetricCard label="Failing" value={summary.failed} />
            <MetricCard label="Critical failures" value={summary.criticalFailures} />
            <MetricCard label="Major failures" value={summary.majorFailures} />
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-900">Recommended reading</div>
            <div className="mt-2 text-sm leading-6 text-zinc-700">
              {summary.keywordStuffingFailed ? (
                <>
                  Priority remains the anti-keyword-stuffing layer. Until this trap is
                  blocked, the engine can still produce false positives on artificially
                  dense answers.
                </>
              ) : summary.failed > 0 ? (
                <>
                  Keyword stuffing appears under control. Remaining work is now mostly on
                  business realism and calibration of buyer posture.
                </>
              ) : (
                <>
                  All current evaluator tests are aligned with expectations. The engine is
                  ready for a V1 stabilization phase.
                </>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {data.map((test) => (
            <TestCaseCard key={test.name} test={test} />
          ))}
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Raw JSON</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Useful for manual verification or copy-paste into a debugging workflow.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRawOpen((v) => !v)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              {rawOpen ? "Hide raw JSON" : "Show raw JSON"}
            </button>
          </div>

          {rawOpen ? (
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-50 p-4 text-xs text-zinc-800">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : null}
        </section>
      </div>
    </main>
  );
}