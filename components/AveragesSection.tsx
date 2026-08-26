"use client";

import { useState } from "react";
import type { DowAgg } from "@/lib/analytics";
import { usd } from "@/lib/format";
import { BRAND } from "@/lib/theme";

interface Avg {
  salePerOrder: number;
  commPerOrder: number;
  salePerDay: number;
  commPerDay: number;
  days: number;
}

type DowMetric = "avgComm" | "avgSale";

/** Averages for the currently-selected period. Prominent: per-day averages.
 *  Secondary: a compact by-weekday breakdown. Always expanded (lives at the bottom). */
export function AveragesSection({
  avg,
  dow,
  periodLabel,
}: {
  avg: Avg;
  dow: DowAgg[];
  periodLabel: string;
}) {
  const [dowMetric, setDowMetric] = useState<DowMetric>("avgComm");

  const stats = [
    { label: "Avg sale / day", value: usd(avg.salePerDay) },
    { label: "Avg comm. / day", value: usd(avg.commPerDay) },
  ];

  const max = Math.max(...dow.map((d) => d[dowMetric]), 0.0001);
  const best = dow.reduce((b, d) => (d[dowMetric] > b[dowMetric] ? d : b), dow[0]);
  const hasDow = dow.some((d) => d.dayCount > 0);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-secondary">Averages this period</h2>
        <span className="text-xs text-text-muted">· {periodLabel}</span>
      </div>

      <div className="px-4 py-4">
        {/* Prominent: per-day averages */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-[11px] uppercase tracking-wide text-text-muted">{s.label}</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">{s.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          over {avg.days} day{avg.days === 1 ? "" : "s"} in this range
        </p>

        {/* Secondary: which weekdays sell biggest (compact, muted) */}
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary">Average by day of week</span>
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
    </div>
  );
}
