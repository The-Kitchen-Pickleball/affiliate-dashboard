"use client";

import { useEffect, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  startOfYear,
} from "date-fns";
import { shortDate } from "@/lib/format";

interface Props {
  start: string | null; // active custom range start (YYYY-MM-DD)
  end: string | null;
  onApply: (start: string, end: string) => void;
  onClear: () => void;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (s: string) => new Date(`${s}T00:00:00`);

function presets(): { label: string; from: Date; to: Date }[] {
  const today = new Date();
  return [
    { label: "This month", from: startOfMonth(today), to: today },
    { label: "Last month", from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) },
    { label: "Last 7 days", from: subDays(today, 6), to: today },
    { label: "Last 30 days", from: subDays(today, 29), to: today },
    { label: "This year", from: startOfYear(today), to: today },
  ];
}

/** Last N months as { value:"YYYY-MM", label:"Mar 2026" }, newest first. */
function recentMonths(n = 18): { value: string; label: string }[] {
  const base = startOfMonth(new Date());
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(base, i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") };
  });
}

/** Smooth custom-date UX: one-click quick ranges + a click-a-range calendar,
 *  in a centered modal. Replaces the old two-native-input approach. */
export function DateRangePicker({ start, end, onApply, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    start && end ? { from: parse(start), to: parse(end) } : undefined,
  );

  useEffect(() => {
    setRange(start && end ? { from: parse(start), to: parse(end) } : undefined);
  }, [start, end]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const active = Boolean(start && end);
  const label = active ? `${shortDate(start!)} – ${shortDate(end!)}` : "Custom date";

  function applyDates(from: Date, to: Date) {
    onApply(iso(from), iso(to));
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-w-[12.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm"
        style={
          active
            ? { borderColor: "var(--brand)", color: "var(--brand)", background: "var(--surface)" }
            : { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }
        }
      >
        <span aria-hidden>📅</span>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Pick a date range</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-text-muted hover:bg-surface-2"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Quick ranges — explicit cell order:
                top:    This month | Last month  | Choose month
                bottom: Last 7 days | Last 30 days | This year   */}
            <div className="mb-4">
              <div className="mb-1.5 text-xs font-medium text-text-secondary">Quick ranges</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(() => {
                  const ps = presets();
                  const btn = (p: { label: string; from: Date; to: Date }) => (
                    <button
                      key={p.label}
                      onClick={() => applyDates(p.from, p.to)}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2"
                    >
                      {p.label}
                    </button>
                  );
                  const monthSelect = (
                    <select
                      key="choose-month"
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const d = parse(`${e.target.value}-01`);
                        applyDates(startOfMonth(d), endOfMonth(d));
                      }}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2"
                      aria-label="Choose month"
                    >
                      <option value="">Choose month</option>
                      {recentMonths().map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  );
                  // ps = [This month, Last month, Last 7 days, Last 30 days, This year]
                  return [btn(ps[0]), btn(ps[1]), monthSelect, btn(ps[2]), btn(ps[3]), btn(ps[4])];
                })()}
              </div>
            </div>

            {/* Click a start day, then an end day */}
            <div className="mb-1.5 text-xs font-medium text-text-secondary">Or pick exact days</div>
            <div
              className="flex justify-center rounded-xl border border-border p-2"
              style={
                {
                  "--rdp-accent-color": "var(--brand)",
                  "--rdp-accent-background-color": "color-mix(in srgb, var(--brand) 16%, transparent)",
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

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  onClear();
                  setRange(undefined);
                  setOpen(false);
                }}
                className="text-sm text-text-muted hover:underline"
              >
                Clear
              </button>
              <button
                onClick={() => range?.from && range?.to && applyDates(range.from, range.to)}
                disabled={!range?.from || !range?.to}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--brand-ink)] disabled:opacity-40"
                style={{ background: "var(--brand)" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
