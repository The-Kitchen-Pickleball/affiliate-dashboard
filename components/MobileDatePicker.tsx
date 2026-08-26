"use client";

import { useEffect, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import type { RangePreset } from "@/lib/analytics";
import { shortDate } from "@/lib/format";

interface Props {
  preset: RangePreset;
  onPreset: (p: RangePreset) => void;
  customStart: string | null;
  customEnd: string | null;
  onCustomRange: (start: string, end: string) => void;
  onClearCustom: () => void;
  className?: string; // extra classes for the trigger button (e.g. "w-full")
}

const QUICK: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
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
const LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  wtd: "Week to date",
  mtd: "Month to date",
  ytd: "Year to date",
  all: "All time",
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (s: string) => new Date(`${s}T00:00:00`);

export function MobileDatePicker({
  preset,
  onPreset,
  customStart,
  customEnd,
  onCustomRange,
  onClearCustom,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    customStart && customEnd ? { from: parse(customStart), to: parse(customEnd) } : undefined,
  );

  useEffect(() => {
    setRange(customStart && customEnd ? { from: parse(customStart), to: parse(customEnd) } : undefined);
  }, [customStart, customEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isCustom = Boolean(customStart && customEnd);
  const triggerLabel = isCustom ? `${shortDate(customStart!)} – ${shortDate(customEnd!)}` : LABELS[preset];

  function choose(p: RangePreset) {
    onClearCustom();
    onPreset(p);
    setOpen(false);
  }
  function applyCustom() {
    if (range?.from && range?.to) {
      onCustomRange(iso(range.from), iso(range.to));
      setOpen(false);
    }
  }

  function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
          active ? "border-transparent text-[var(--brand-ink)]" : "border-border bg-surface text-text-secondary active:bg-surface-2"
        }`}
        style={active ? { background: "var(--brand)" } : undefined}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${className}`}
        style={{ borderColor: "var(--brand)", color: "var(--brand)", background: "var(--surface)" }}
      >
        <span aria-hidden>📅</span>
        {triggerLabel}
        <span className="text-xs opacity-60">▾</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end animate-fade-in" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setOpen(false)}>
          <div
            className="animate-sheet-up max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface px-5 pb-8 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: "var(--border)" }} />

            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Date range</h3>
              <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-text-muted active:bg-surface-2" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Quick ranges</div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <Pill key={q.key} label={q.label} active={!isCustom && preset === q.key} onClick={() => choose(q.key)} />
              ))}
            </div>

            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">To date</div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {TO_DATE.map((q) => (
                <Pill key={q.key} label={q.label} active={!isCustom && preset === q.key} onClick={() => choose(q.key)} />
              ))}
            </div>

            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Custom range</div>
            <div
              className="flex justify-center rounded-2xl border border-border p-2"
              style={
                {
                  "--rdp-accent-color": "var(--brand)",
                  "--rdp-accent-background-color": "color-mix(in srgb, var(--brand) 20%, transparent)",
                  "--rdp-today-color": "var(--brand)",
                } as React.CSSProperties
              }
            >
              <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={1}
                defaultMonth={range?.from ?? new Date()}
                captionLayout="dropdown"
                startMonth={new Date(2025, 0)}
                endMonth={new Date()}
                showOutsideDays
              />
            </div>

            <button
              onClick={applyCustom}
              disabled={!range?.from || !range?.to}
              className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-[var(--brand-ink)] disabled:opacity-40"
              style={{ background: "var(--brand)" }}
            >
              Apply custom range
            </button>
          </div>
        </div>
      )}
    </>
  );
}
