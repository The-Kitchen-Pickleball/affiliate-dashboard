"use client";

function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Arrow through single days. Shown when the current window is one day. */
export function DayStepper({
  day,
  today,
  onChange,
  onToday,
}: {
  day: string; // YYYY-MM-DD currently shown
  today: string; // YYYY-MM-DD Central today
  onChange: (day: string) => void;
  onToday: () => void;
}) {
  const atToday = day >= today;
  const [y, m, d] = day.split("-").map(Number);
  const label =
    day === today
      ? "Today"
      : new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const btn = "rounded-lg border border-border bg-surface px-3 py-1.5 text-base leading-none hover:bg-surface-2 disabled:opacity-30";

  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => onChange(shiftDay(day, -1))} className={btn} aria-label="Previous day">
        ‹
      </button>
      <div className="min-w-[7.5rem] text-center text-sm font-semibold tabular-nums">{label}</div>
      <button onClick={() => onChange(shiftDay(day, 1))} disabled={atToday} className={btn} aria-label="Next day">
        ›
      </button>
      {day !== today && (
        <button onClick={onToday} className="ml-1 text-xs font-medium hover:underline" style={{ color: "var(--brand)" }}>
          Today
        </button>
      )}
    </div>
  );
}
