type ScoreCardProps = {
  label: string;
  value: number;
};

function getValueLabel(value: number) {
  if (value <= 0) return "Weak";
  if (value === 1) return "Limited";
  if (value === 2) return "Acceptable";
  return "Strong";
}

export function ScoreCard({ label, value }: ScoreCardProps) {
  const width = Math.max(0, Math.min(100, (value / 3) * 100));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-900">{label}</div>
          <div className="mt-1 text-xs text-zinc-500">{getValueLabel(value)}</div>
        </div>
        <div className="text-lg font-semibold text-zinc-900">{value}/3</div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-zinc-900 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}