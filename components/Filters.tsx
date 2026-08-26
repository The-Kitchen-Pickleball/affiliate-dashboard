"use client";

import { type RangePreset, todayCentral } from "@/lib/analytics";
import { DateRangePicker } from "./DateRangePicker";
import { MobileDatePicker } from "./MobileDatePicker";
import { BrandPicker } from "./BrandPicker";
import { DayStepper } from "./DayStepper";

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
  const today = todayCentral();
  const singleDay =
    customStart && customEnd && customStart === customEnd
      ? customStart
      : !customStart && preset === "today"
        ? today
        : null;

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

      {/* MOBILE controls: date + brand fill the row evenly, stepper full-width below */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex gap-2">
          <div className="flex-1">
            <MobileDatePicker
              preset={preset}
              onPreset={onPreset}
              customStart={customStart}
              customEnd={customEnd}
              onCustomRange={onCustomRange}
              onClearCustom={onClearCustom}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <BrandPicker
              advertisers={advertisers}
              selected={selectedAdvertisers[0] ?? null}
              onChange={(id) => onAdvertisers(id ? [id] : [])}
              className="w-full"
            />
          </div>
        </div>
        {singleDay && (
          <DayStepper
            fullWidth
            day={singleDay}
            today={today}
            onChange={(d) => onCustomRange(d, d)}
            onToday={() => {
              onClearCustom();
              onPreset("today");
            }}
          />
        )}
      </div>

      {/* DESKTOP controls: brand + custom date + stepper, left-packed */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <BrandPicker
          advertisers={advertisers}
          selected={selectedAdvertisers[0] ?? null}
          onChange={(id) => onAdvertisers(id ? [id] : [])}
        />
        <DateRangePicker start={customStart} end={customEnd} onApply={onCustomRange} onClear={onClearCustom} />
        {singleDay && (
          <DayStepper
            day={singleDay}
            today={today}
            onChange={(d) => onCustomRange(d, d)}
            onToday={() => {
              onClearCustom();
              onPreset("today");
            }}
          />
        )}
      </div>
    </div>
  );
}
