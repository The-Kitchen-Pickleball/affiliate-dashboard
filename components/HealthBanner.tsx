import type { HealthCheck } from "@/lib/types";

/** A prominent banner at the top of the dashboard when a health check fails.
 *  Clicking it opens the full report. `problems` is the already-filtered list of
 *  active (non-dismissed) non-ok checks. */
export function HealthBanner({ problems, onOpen }: { problems: HealthCheck[]; onOpen: () => void }) {
  if (problems.length === 0) return null;
  const hasError = problems.some((c) => c.status === "error");
  const accent = hasError ? "var(--bad)" : "#eab308";

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-xl border p-3 text-left text-sm sm:p-4"
      style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 12%, var(--surface))` }}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-base leading-none">{hasError ? "🚨" : "⚠️"}</span>
        <div className="min-w-0">
          <div className="font-semibold" style={{ color: accent }}>
            {hasError ? "Something needs attention" : "Possible data drift"} — tap for details
          </div>
          <ul className="mt-1 flex flex-col gap-0.5 text-text-secondary">
            {problems.map((c, n) => (
              <li key={n}>{c.detail}</li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}
