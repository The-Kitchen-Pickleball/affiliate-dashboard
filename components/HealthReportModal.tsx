"use client";

import { useEffect } from "react";
import type { HealthCheck } from "@/lib/types";
import { heartbeatLabel } from "@/lib/format";

const ICON = { ok: "✓", warn: "⚠", error: "🚨" } as const;
const COLOR = { ok: "var(--good)", warn: "#eab308", error: "var(--bad)" } as const;

/** The on-demand "is everything good this morning?" report — every check with a
 *  pass/fail and detail. Opened by clicking the status line in the header. */
export function HealthReportModal({
  checks,
  lastScrape,
  onClose,
}: {
  checks: HealthCheck[];
  lastScrape: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const worst = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";
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
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
              <span aria-hidden className="mt-0.5 text-sm leading-none" style={{ color: COLOR[c.status] }}>{ICON[c.status]}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-text-secondary">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-text-muted">
          These checks run automatically every time the dashboard loads. If anything is off, it also shows as a banner up top.
        </p>
      </div>
    </div>
  );
}
