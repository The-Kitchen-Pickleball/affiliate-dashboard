"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usd, num } from "@/lib/format";
import { BRAND } from "@/lib/theme";

type Metric = "commission" | "sales" | "count";
export type Granularity = "day" | "month";

/** A pre-formatted trend point. `label` is what the axis/tooltip show; `current`
 *  flags an in-progress (partial) bucket; `deltaPct` is change vs the prior point. */
export interface TrendPoint {
  /** Raw bucket key: "YYYY-MM-DD" (daily) or "YYYY-MM" (monthly) — used for drill-in. */
  key: string;
  label: string;
  commission: number;
  sales: number;
  count: number;
  current?: boolean;
  deltaPct?: number | null;
}

interface Props {
  data: TrendPoint[];
  metric: Metric;
  onMetric: (m: Metric) => void;
  granularity: Granularity;
  onGranularity: (g: Granularity) => void;
  /** Daily lookback in days (independent of the page's date filter). */
  range: number;
  onRange: (n: number) => void;
  /** Click a point/bar to drill the whole page into that day/month. */
  onSelect: (p: TrendPoint) => void;
}

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "30", label: "30d", days: 30 },
  { key: "90", label: "90d", days: 90 },
  { key: "180", label: "6mo", days: 180 },
  { key: "365", label: "1yr", days: 365 },
];

const METRICS: { key: Metric; label: string }[] = [
  { key: "commission", label: "Commission" },
  { key: "sales", label: "Sales" },
  { key: "count", label: "# Orders" },
];

function fmt(metric: Metric, v: number): string {
  return metric === "count" ? num(v) : usd(v, { cents: false });
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            value === o.key ? "text-[var(--brand-ink)]" : "text-text-muted hover:bg-surface-2"
          }`}
          style={value === o.key ? { background: "var(--brand)" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface TipProps {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  metric: Metric;
}
function CustomTooltip({ active, payload, metric }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const up = p.deltaPct != null && p.deltaPct > 0;
  const down = p.deltaPct != null && p.deltaPct < 0;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs"
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <div className="font-medium">
        {p.label}
        {p.current && <span className="ml-1 text-text-muted">(so far)</span>}
      </div>
      <div className="mt-0.5 tabular-nums">{fmt(metric, p[metric])}</div>
      {p.deltaPct != null && (
        <div className="mt-0.5 tabular-nums" style={{ color: up ? "var(--good)" : down ? "var(--bad)" : "var(--text-muted)" }}>
          {up ? "▲" : down ? "▼" : "—"} {Math.abs(p.deltaPct).toFixed(1)}% vs prev
        </div>
      )}
      <div className="mt-1 text-[10px] text-text-muted">click to filter to this</div>
    </div>
  );
}

export function TrendChart({ data, metric, onMetric, granularity, onGranularity, range, onRange, onSelect }: Props) {
  const [open, setOpen] = useState(true);
  const yTick = (v: number) => (metric === "count" ? num(v) : usd(v, { cents: false }));

  // Recharts hands us the hovered point's payload on click.
  const handleChartClick = (state: { activePayload?: { payload: TrendPoint }[] } | null) => {
    const p = state?.activePayload?.[0]?.payload;
    if (p) onSelect(p);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2"
      >
        <h2 className="text-sm font-semibold text-text-secondary">Trend</h2>
        <span className="text-xs text-text-muted transition-transform" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          ▾
        </span>
      </button>

      {open && (
      <div className="px-4 pb-4 sm:px-5">
      <div className="mb-3 mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={granularity}
            onChange={(v) => onGranularity(v as Granularity)}
            options={[
              { key: "day", label: "Daily" },
              { key: "month", label: "Monthly" },
            ]}
          />
          {granularity === "day" && (
            <Segmented
              value={String(range)}
              onChange={(v) => onRange(Number(v))}
              options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            />
          )}
        </div>
        <Segmented value={metric} onChange={(v) => onMetric(v as Metric)} options={METRICS} />
      </div>

      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {granularity === "month" ? (
            <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%" onClick={handleChartClick} style={{ cursor: "pointer" }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} minTickGap={4} />
              <YAxis tickFormatter={yTick} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={54} />
              <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<CustomTooltip metric={metric} />} />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={BRAND} fillOpacity={d.current ? 0.45 : 1} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis tickFormatter={yTick} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={54} />
              <Tooltip content={<CustomTooltip metric={metric} />} />
              <Area type="monotone" dataKey={metric} stroke={BRAND} strokeWidth={2} fill="url(#fill)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {granularity === "month" && (
        <p className="mt-2 text-xs text-text-muted">Last 12 months · lighter bar = current month so far</p>
      )}
      </div>
      )}
    </div>
  );
}
