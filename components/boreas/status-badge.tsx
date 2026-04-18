import type { ReportStatus } from "@/lib/boreas/generate-report";

type StatusBadgeProps = {
  status: ReportStatus;
  className?: string;
};

const statusLabels: Record<ReportStatus, string> = {
  fail: "FAIL",
  borderline: "BORDERLINE",
  pass: "PASS",
  strong_pass: "STRONG PASS",
};

const statusClasses: Record<ReportStatus, string> = {
  fail: "border-red-200 bg-red-50 text-red-700",
  borderline: "border-amber-200 bg-amber-50 text-amber-700",
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  strong_pass: "border-blue-200 bg-blue-50 text-blue-700",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        statusClasses[status],
        className ?? "",
      ].join(" ")}
    >
      {statusLabels[status]}
    </span>
  );
}