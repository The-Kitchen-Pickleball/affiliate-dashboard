import type { HealthIssue } from "@/lib/types";

/** A prominent banner at the top of the dashboard when a live health check fails
 *  (RPM vs platform, per-brand drift, or a stale scraper). Shows nothing when all
 *  is well. This is the alert surface that replaces relying on Slack. */
export function HealthBanner({ issues }: { issues: HealthIssue[] }) {
  if (!issues || issues.length === 0) return null;
  const hasError = issues.some((i) => i.severity === "error");
  const accent = hasError ? "var(--bad)" : "#eab308";

  return (
    <div
      className="rounded-xl border p-3 text-sm sm:p-4"
      style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 12%, var(--surface))` }}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-base leading-none">{hasError ? "🚨" : "⚠️"}</span>
        <div className="min-w-0">
          <div className="font-semibold" style={{ color: accent }}>
            {hasError ? "Something needs attention" : "Possible data drift"}
          </div>
          <ul className="mt-1 flex flex-col gap-0.5 text-text-secondary">
            {issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
