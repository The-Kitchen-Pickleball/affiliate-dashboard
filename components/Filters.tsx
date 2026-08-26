"use client";

import type { RangePreset } from "@/lib/analytics";
import { DateRangePicker } from "./DateRangePicker";

const ROLLING: { key: RangePreset; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];
const TO_DATE: { key: RangePreset; label: string }[] = [
  { key: "wtd", label: "Week to date" },
  { key: "mtd", label: "Month to date" },
  { key: "ytd", label: "Year to date" },
  { key: "all", label: "All time" },
];

interface Props {
  preset: RangePreset;
  onPreset: (p: RangePreset) => void;
  advertisers: { id: string; name: string }[];
  selectedAdvertisers: string[];
  onAdvertisers: (ids: string[]) => void;
  /** Active custom date range (YYYY-MM-DD), or null when using a preset. */
  customStart: string | null;
  customEnd: string | null;
  onCustomRange: (start: string, end: string) => void;
  onClearCustom: () => void;
}

export function Filters({
  preset,
  onPreset,
  advertisers,
  selectedAdvertisers,
  onAdvertisers,
  customStart,
  customEnd,
  onCustomRange,
  onClearCustom,
}: Props) {
  const todayActive = !customStart && preset === "today";
  const rollingValue = !customStart && ROLLING.some((r) => r.key === preset) ? preset : "";
  const toDateValue = !customStart && TO_DATE.some((r) => r.key === preset) ? preset : "";

  function pick(value: string) {
    if (!value) return;
    onClearCustom();
    onPreset(value as RangePreset);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Date range: Today + a "last N days" dropdown + a "to date" dropdown */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            onClearCustom();
            onPreset("today");
          }}
          className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            todayActive
              ? "border-transparent text-[var(--brand-ink)]"
              : "border-border bg-surface text-text-secondary hover:bg-surface-2"
          }`}
          style={todayActive ? { background: "var(--brand)" } : undefined}
        >
          Today
        </button>

        <select
          value={rollingValue}
          onChange={(e) => pick(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
          style={rollingValue ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
        >
          <option value="">Last…</option>
          {ROLLING.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>

        <select
          value={toDateValue}
          onChange={(e) => pick(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
          style={toDateValue ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
        >
          <option value="">To date…</option>
          {TO_DATE.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Advertiser select via native select for mobile-friendliness */}
        <select
          value={selectedAdvertisers[0] ?? ""}
          onChange={(e) => onAdvertisers(e.target.value ? [e.target.value] : [])}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
        >
          <option value="">All brands</option>
          {advertisers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Custom date / range — calendar + quick presets */}
        <DateRangePicker
          start={customStart}
          end={customEnd}
          onApply={onCustomRange}
          onClear={onClearCustom}
        />
      </div>
    </div>
  );
}
