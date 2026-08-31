import { pctChange } from "@/lib/format";

interface Props {
  label: string;
  value: string;
  current: number;
  previous: number | null;
  comparisonLabel: string;
}

export function KpiCard({ label, value, current, previous, comparisonLabel }: Props) {
  const pct = previous === null ? null : pctChange(current, previous);
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;

  // Shrink the mobile font for very long values (e.g. $1,222,444.79) so they don't
  // overflow the card. Desktop cards are wide enough to stay large regardless.
  const digits = value.replace(/[^0-9]/g, "").length;
  const mobileSize = digits >= 9 ? "text-sm" : digits >= 7 ? "text-base" : "text-lg";

  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:text-xs">
        {label}
      </div>
      <div className={`mt-0.5 font-semibold tabular-nums sm:mt-1 sm:text-3xl ${mobileSize}`}>{value}</div>
      {pct === null ? (
        <div className="mt-0.5 truncate text-[10px] text-text-muted sm:text-xs">{comparisonLabel}</div>
      ) : (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] sm:mt-1 sm:text-xs">
          <span
            className="inline-flex items-center gap-0.5 font-medium tabular-nums"
            style={{ color: up ? "var(--good)" : down ? "var(--bad)" : "var(--text-muted)" }}
          >
            {up ? "▲" : down ? "▼" : "—"} {Math.abs(pct).toFixed(1)}%
          </span>
          <span className="hidden text-text-muted sm:inline">{comparisonLabel}</span>
        </div>
      )}
    </div>
  );
}
