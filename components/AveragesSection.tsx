"use client";

import { useState } from "react";
import type { DowAgg } from "@/lib/analytics";
import { usd } from "@/lib/format";
import { BRAND } from "@/lib/theme";

type DowMetric = "avgComm" | "avgSale";

/** Weekday breakdown for the selected (multi-day) period, collapsed by default.
 *  The per-day averages themselves now sit on the top KPI cards. */
export function AveragesSection({ dow }: { dow: DowAgg[] }) {
  const [dowMetric, setDowMetric] = useState<DowMetric>("avgComm");
  const [open, setOpen] = useState(false);

  const max = Math.max(...dow.map((d) => d[dowMetric]), 0.0001);
  const best = dow.reduce((b, d) => (d[dowMetric] > b[dowMetric] ? d : b), dow[0]);
  const hasDow = dow.some((d) => d.dayCount > 0);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2 ${open ? "border-b border-border" : ""}`}
      >
        <h2 className="text-sm font-semibold text-text-secondary">Average by day of week</h2>
        <span className="text-xs text-text-muted transition-transform" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          ▾
        </span>
      </button>

      {open && (
      <div className="px-4 py-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <div className="flex gap-1">
              {(["avgComm", "avgSale"] as DowMetric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setDowMetric(m)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    dowMetric === m ? "text-[var(--brand)]" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {m === "avgComm" ? "Comm." : "Sales"}
                </button>
              ))}
            </div>
          </div>

          {hasDow ? (
            <div className="flex flex-col gap-1">
              {dow.map((d) => {
                const val = d[dowMetric];
                const pct = (val / max) * 100;
                const isBest = d.dow === best.dow && val > 0;
                return (
                  <div key={d.dow} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] text-text-muted">{d.label}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded" style={{ width: `${pct}%`, background: BRAND, opacity: isBest ? 0.9 : 0.4 }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-text-muted">{usd(val)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted">Not enough data in this range.</p>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
