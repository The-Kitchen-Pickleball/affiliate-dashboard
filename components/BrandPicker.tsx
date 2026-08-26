"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  advertisers: { id: string; name: string }[];
  selected: string | null; // advertiserId or null (= all)
  onChange: (id: string | null) => void;
}

/** Styled brand selector: a button that opens a searchable sheet (bottom sheet on
 *  mobile, centered modal on desktop) matching the date picker. */
export function BrandPicker({ advertisers, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedName = selected ? advertisers.find((a) => a.id === selected)?.name ?? "All brands" : "All brands";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? advertisers.filter((a) => a.name.toLowerCase().includes(s)) : advertisers;
  }, [q, advertisers]);

  function choose(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  function Row({ id, name }: { id: string | null; name: string }) {
    const active = (selected ?? null) === id;
    return (
      <button
        onClick={() => choose(id)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm active:bg-surface-2"
        style={active ? { background: "color-mix(in srgb, var(--brand) 14%, transparent)" } : undefined}
      >
        <span className={active ? "font-semibold" : ""} style={active ? { color: "var(--brand)" } : undefined}>
          {name}
        </span>
        {active && <span style={{ color: "var(--brand)" }}>✓</span>}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
        style={
          selected
            ? { borderColor: "var(--brand)", color: "var(--brand)", background: "var(--surface)" }
            : { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }
        }
      >
        <span aria-hidden>🏓</span>
        {selectedName}
        <span className="text-xs opacity-60">▾</span>
      </button>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-sheet-up flex max-h-[80vh] w-full flex-col rounded-t-3xl border-t border-border bg-surface pb-6 pt-3 sm:max-w-sm sm:rounded-2xl sm:border sm:pb-4 sm:pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full sm:hidden" style={{ background: "var(--border)" }} />

            <div className="mb-3 flex items-center justify-between px-4">
              <h3 className="text-base font-semibold">Brand</h3>
              <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-text-muted active:bg-surface-2" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="px-4">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search brands…"
                className="mb-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-[var(--brand)]"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {!q && <Row id={null} name="All brands" />}
              {filtered.map((a) => (
                <Row key={a.id} id={a.id} name={a.name} />
              ))}
              {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-muted">No brands match.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
