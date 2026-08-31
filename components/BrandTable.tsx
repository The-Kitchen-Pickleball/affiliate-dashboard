"use client";

import { useState } from "react";
import type { BrandDetail } from "@/lib/analytics";
import { usd, num, shortDate } from "@/lib/format";

const STATUS_COLOR: Record<string, string> = {
  approved: "var(--good)",
  pending: "var(--text-muted)",
  declined: "var(--bad)",
};

type SortKey = "advertiser" | "count" | "sales" | "commission";

interface Props {
  rows: BrandDetail[];
  /** When provided, clicking a brand name opens its detail page. */
  onSelectBrand?: (id: string) => void;
  /** On a single-brand page: render the brand's individual sales directly. */
  singleBrand?: boolean;
}

export function BrandTable({ rows, onSelectBrand, singleBrand }: Props) {
  const [sort, setSort] = useState<SortKey>("commission");
  const [asc, setAsc] = useState(false);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Single-brand view: skip the "By brand → one row → expand" layout and just
  // list that brand's transactions under an "Individual sales" header.
  if (singleBrand) {
    const items = [...(rows[0]?.items ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2"
        >
          <h2 className="text-sm font-semibold text-text-secondary">
            Individual sales <span className="font-normal text-text-muted">({items.length})</span>
          </h2>
          <span className="text-xs text-text-muted transition-transform" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
            ▾
          </span>
        </button>
        <div className="overflow-x-auto" hidden={!open}>
          <table className="w-full text-sm">
            <thead className="text-xs text-text-secondary" style={{ background: "var(--surface-2)" }}>
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-right font-semibold">Sale</th>
                <th className="px-3 py-2 text-right font-semibold">Commission</th>
                <th className="px-3 py-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.transactionId} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 text-text-muted tabular-nums">{shortDate(t.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{usd(t.sale)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{usd(t.commission)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[t.status] }} />
                      <span className="capitalize text-text-muted">{t.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-text-muted">No sales in this range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const sorted = [...rows].sort((a, b) => {
    let d: number;
    if (sort === "advertiser") d = a.advertiser.localeCompare(b.advertiser);
    else d = a[sort] - b[sort];
    return asc ? d : -d;
  });

  // Each brand's share of the period total (for the % under its numbers).
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalComm = rows.reduce((s, r) => s + r.commission, 0);
  const pctOf = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : "—");

  function header(key: SortKey, label: string, alignRight = false) {
    const active = sort === key;
    return (
      <th
        className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold ${alignRight ? "text-right" : "text-left"}`}
        onClick={() => {
          if (active) setAsc(!asc);
          else {
            setSort(key);
            setAsc(false);
          }
        }}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="text-[10px] text-text-muted">{active ? (asc ? "▲" : "▼") : ""}</span>
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2"
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-text-secondary">
          By brand <span className="font-normal text-text-muted">({sorted.length})</span>
        </h2>
        <span className="text-xs text-text-muted transition-transform" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          ▾
        </span>
      </button>
      <div className="overflow-x-auto" hidden={!open}>
        <table className="w-full text-sm">
          <thead className="text-xs text-text-secondary" style={{ background: "var(--surface-2)" }}>
            <tr>
              {header("advertiser", "Brand")}
              {header("count", "# Sales", true)}
              {header("sales", "Total Sales", true)}
              {header("commission", "Commission", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isOpen = expanded.has(r.advertiserId);
              return (
                <FragmentRow
                  key={r.advertiserId}
                  r={r}
                  isOpen={isOpen}
                  onToggle={() => toggleRow(r.advertiserId)}
                  onSelectBrand={onSelectBrand}
                  salesShare={pctOf(r.sales, totalSales)}
                  commShare={pctOf(r.commission, totalComm)}
                />
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-text-muted">
                  No sales in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  r,
  isOpen,
  onToggle,
  onSelectBrand,
  salesShare,
  commShare,
}: {
  r: BrandDetail;
  isOpen: boolean;
  onToggle: () => void;
  onSelectBrand?: (id: string) => void;
  salesShare: string;
  commShare: string;
}) {
  return (
    <>
      <tr className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={onToggle}>
        <td className="whitespace-nowrap px-3 py-2 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="text-[10px] text-text-muted transition-transform"
              style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▸
            </span>
            {onSelectBrand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBrand(r.advertiserId);
                }}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: "var(--brand)" }}
                title={`View ${r.advertiser} details`}
              >
                {r.advertiser}
              </button>
            ) : (
              r.advertiser
            )}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{num(r.count)}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          <div>{usd(r.sales)}</div>
          <div className="text-[11px] text-text-muted">{salesShare}</div>
        </td>
        <td className="px-3 py-2 text-right font-medium tabular-nums">
          <div>{usd(r.commission)}</div>
          <div className="text-[11px] font-normal text-text-muted">{commShare}</div>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-border" style={{ background: "var(--surface-2)" }}>
          <td colSpan={4} className="px-3 py-2.5">
            <div className="pl-5">
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                <Dot color="var(--good)" label="Approved" value={r.approvedComm} />
                <Dot color="var(--text-muted)" label="Pending" value={r.pendingComm} />
                {r.declinedComm > 0 && <Dot color="var(--bad)" label="Declined" value={r.declinedComm} muted />}
              </div>

              {r.items.length > 0 && (
                <div className="mt-2.5 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    <span className="w-16 shrink-0">Date</span>
                    <span className="flex-1 text-right">Sale</span>
                    <span className="w-20 text-right">Commission</span>
                    <span className="w-20 text-right">Status</span>
                  </div>
                  {r.items.map((t) => (
                    <div
                      key={t.transactionId}
                      className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0"
                    >
                      <span className="w-16 shrink-0 text-text-muted tabular-nums">{shortDate(t.date)}</span>
                      <span className="flex-1 text-right tabular-nums text-text-secondary">{usd(t.sale)}</span>
                      <span className="w-20 text-right font-medium tabular-nums">{usd(t.commission)}</span>
                      <span className="inline-flex w-20 items-center justify-end gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[t.status] }} />
                        <span className="capitalize text-text-muted">{t.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Dot({ color, label, value, muted }: { color: string; label: string; value: number; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className={`font-semibold tabular-nums ${muted ? "text-text-muted" : ""}`}>{usd(value)}</span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}
