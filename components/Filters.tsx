"use client";

import type { RangePreset } from "@/lib/analytics";
import { DateRangePicker } from "./DateRangePicker";
import { MobileDatePicker } from "./MobileDatePicker";

// Desktop shows all presets as pills; mobile uses the slide-up date sheet.
const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "wtd", label: "WTD" },
  { key: "mtd", label: "MTD" },
  { key: "ytd", label: "YTD" },
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
  return (
    <div className="flex flex-col gap-3">
      {/* Desktop: preset pills */}
      <div className="hidden flex-wrap gap-1.5 sm:flex">
        {PRESETS.map((p) => {
          const active = !customStart && preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => {
                onClearCustom();
                onPreset(p.key);
              }}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent text-[var(--brand-ink)]"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-2"
              }`}
              style={active ? { background: "var(--brand)" } : undefined}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mobile-only date picker (sheet) */}
        <div className="sm:hidden">
          <MobileDatePicker
            preset={preset}
            onPreset={onPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomRange={onCustomRange}
            onClearCustom={onClearCustom}
          />
        </div>

        {/* Brand select (both) */}
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

        {/* Desktop-only custom date (calendar modal) */}
        <div className="hidden sm:block">
          <DateRangePicker
            start={customStart}
            end={customEnd}
            onApply={onCustomRange}
            onClear={onClearCustom}
          />
        </div>
      </div>
    </div>
  );
}
