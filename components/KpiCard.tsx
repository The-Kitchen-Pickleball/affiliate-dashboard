import { pctChange } from "@/lib/format";

interface Props {
  label: string;
  value: string;
  current: number;
  previous: number | null;
  comparisonLabel: string;
  /** Shared value font size (Tailwind classes) so all KPI cards match, sized by
   *  the Dashboard to fit the longest of the three values. */
  valueSize: string;
  /** Per-day average for multi-day ranges, e.g. "$4,833 / day avg". Omitted for a single day. */
  perDay?: string;
}

export function KpiCard({ label, value, current, previous, comparisonLabel, valueSize, perDay }: Props) {
  const pct = previous === null ? null : pctChange(current, previous);
  const up = pct !== null && pct > 0;
  const down = pct !== null && pct < 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:text-xs">
        {label}
      </div>
      <div className={`mt-0.5 font-semibold tabular-nums sm:mt-1 ${valueSize}`}>{value}</div>
      {perDay && (
        <div className="mt-0.5 truncate text-[11px] font-medium tabular-nums text-text-secondary sm:text-sm">
          {perDay} <span className="font-normal text-text-muted">/ day avg</span>
        </div>
      )}
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
