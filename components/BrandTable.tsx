"use client";

import { useState } from "react";
import type { BrandAgg } from "@/lib/analytics";
import { usd, num } from "@/lib/format";
import { getBrandLoginUrl } from "@/lib/brandLinks";

type SortKey = "advertiser" | "count" | "sales" | "commission";

interface Props {
  rows: BrandAgg[];
}

export function BrandTable({ rows }: Props) {
  const [sort, setSort] = useState<SortKey>("commission");
  const [asc, setAsc] = useState(false);
  const [open, setOpen] = useState(true);

  const sorted = [...rows].sort((a, b) => {
    let d: number;
    if (sort === "advertiser") d = a.advertiser.localeCompare(b.advertiser);
    else d = a[sort] - b[sort];
    return asc ? d : -d;
  });

  function header(key: SortKey, label: string, alignRight = false) {
    const active = sort === key;
    return (
      <th
        className={`cursor-pointer select-none px-3 py-2 font-semibold ${alignRight ? "text-right" : "text-left"}`}
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
            {sorted.map((r) => (
              <tr key={r.advertiserId} className="border-t border-border">
                <td className="px-3 py-2 font-medium">
                  {getBrandLoginUrl(r.advertiserId) ? (
                    <a
                      href={getBrandLoginUrl(r.advertiserId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: "var(--brand)" }}
                      title={`Open ${r.advertiser} affiliate login`}
                    >
                      {r.advertiser}
                      <span aria-hidden className="text-[10px] opacity-60">↗</span>
                    </a>
                  ) : (
                    r.advertiser
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{num(r.count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{usd(r.sales)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{usd(r.commission)}</td>
              </tr>
            ))}
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
