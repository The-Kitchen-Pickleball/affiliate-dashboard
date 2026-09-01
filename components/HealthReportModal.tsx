"use client";

import { useEffect } from "react";
import type { HealthCheck } from "@/lib/types";
import { heartbeatLabel } from "@/lib/format";

const ICON = { ok: "✓", warn: "⚠", error: "🚨" } as const;
const COLOR = { ok: "var(--good)", warn: "#eab308", error: "var(--bad)" } as const;

/** The on-demand "is everything good this morning?" report — every check with a
 *  pass/fail and detail. Dismissible warnings can be acknowledged (remembered per
 *  browser); errors can't be dismissed. */
export function HealthReportModal({
  checks,
  lastScrape,
  dismissed,
  onToggleDismiss,
  onClose,
}: {
  checks: HealthCheck[];
  lastScrape: string | null;
  dismissed: Set<string>;
  onToggleDismiss: (id: string, on: boolean) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isDismissed = (c: HealthCheck) => Boolean(c.dismissId && dismissed.has(c.dismissId));
  const active = checks.filter((c) => c.status !== "ok" && !isDismissed(c));
  const worst = active.some((c) => c.status === "error") ? "error" : active.length ? "warn" : "ok";
  const headline =
    worst === "ok" ? "Everything looks good" : worst === "warn" ? "A couple things to review" : "Something needs attention";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="my-8 w-full max-w-md animate-fade-in rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span aria-hidden style={{ color: COLOR[worst] }}>{ICON[worst]}</span>
            {headline}
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-0.5 text-text-muted hover:bg-surface-2">✕</button>
        </div>
        {lastScrape && <p className="mb-4 text-xs text-text-muted">Data last updated {heartbeatLabel(lastScrape)}</p>}

        <div className="flex flex-col gap-2">
          {checks.map((c, i) => {
            const dis = isDismissed(c);
            const shown = dis ? "ok" : c.status; // a dismissed warning reads as resolved
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border border-border p-3 ${dis ? "opacity-55" : ""}`}>
                <span aria-hidden className="mt-0.5 text-sm leading-none" style={{ color: COLOR[shown] }}>{ICON[shown]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-text-secondary">{c.detail}</div>
                  {c.dismissId && (
                    <button
                      onClick={() => onToggleDismiss(c.dismissId!, !dis)}
                      className="mt-1.5 rounded border border-border px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-2"
                    >
                      {dis ? "Undo dismiss" : "Dismiss"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-text-muted">
          These checks run automatically every time the dashboard loads. Anything not dismissed also shows as a banner up top.
        </p>
      </div>
    </div>
  );
}
