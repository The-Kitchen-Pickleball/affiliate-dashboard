"use client";

function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Arrow through single days. A tight connected control (‹ | day | ›). */
export function DayStepper({
  day,
  today,
  onChange,
  onToday,
  fullWidth,
}: {
  day: string; // YYYY-MM-DD currently shown
  today: string; // YYYY-MM-DD Central today
  onChange: (day: string) => void;
  onToday: () => void;
  fullWidth?: boolean;
}) {
  const atToday = day >= today;
  const [y, m, d] = day.split("-").map(Number);
  const label =
    day === today
      ? "Today"
      : new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const arrow = "px-3 py-1.5 text-base leading-none hover:bg-surface-2 disabled:opacity-30";

  return (
    <div className={`flex items-center gap-2 ${fullWidth ? "w-full" : "self-start"}`}>
      <div
        className={`items-center overflow-hidden rounded-lg border border-border bg-surface ${
          fullWidth ? "flex flex-1" : "inline-flex"
        }`}
      >
        <button onClick={() => onChange(shiftDay(day, -1))} className={arrow} aria-label="Previous day">
          ‹
        </button>
        <div
          className={`border-x border-border px-3 py-1.5 text-center text-sm font-semibold tabular-nums ${
            fullWidth ? "flex-1" : "min-w-[6.5rem]"
          }`}
        >
          {label}
        </div>
        <button
          onClick={() => onChange(shiftDay(day, 1))}
          disabled={atToday}
          className={arrow}
          aria-label="Next day"
        >
          ›
        </button>
      </div>
      {day !== today && (
        <button onClick={onToday} className="shrink-0 text-xs font-medium hover:underline" style={{ color: "var(--brand)" }}>
          Today
        </button>
      )}
    </div>
  );
}
