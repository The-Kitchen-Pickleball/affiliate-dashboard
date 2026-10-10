"use client";

import { useMemo, useState } from "react";
import { usd } from "@/lib/format";
import { getBrandLogo } from "@/lib/brandLogos";
import type { PayoutRow } from "@/lib/types";

type SortKey = "owed" | "paid" | "name";

/** "Last payout" date: "YYYY-MM-DD" → "Oct 27, 2026". */
function payoutDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Payouts tab — per-brand "paid vs. still owed," a current standing (NOT date-
 * filtered; affiliate programs pay on a cycle). Every brand gets a line: the ones
 * whose platform reports payout status show real numbers; the rest say "Can't be
 * tracked." Its own tab precisely because these are lifetime balances that don't
 * respond to the date picker.
 */
export function PayoutsView({
  payouts,
  brandName,
}: {
  payouts: PayoutRow[];
  brandName: (id: string) => string;
}) {
  const [sort, setSort] = useState<SortKey>("owed");

  const tracked = payouts.filter((p) => p.tracked);
  const untracked = payouts.filter((p) => !p.tracked);

  const totalOwed = tracked.reduce((s, p) => s + p.outstanding, 0);
  const totalPaid = tracked.reduce((s, p) => s + p.paid, 0);

  const sortedTracked = useMemo(() => {
    const arr = [...tracked];
    if (sort === "owed") arr.sort((a, b) => b.outstanding - a.outstanding);
    else if (sort === "paid") arr.sort((a, b) => b.paid - a.paid);
    else arr.sort((a, b) => brandName(a.advertiserId).localeCompare(brandName(b.advertiserId)));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked, sort]);

  const sortedUntracked = useMemo(
    () =>
      [...untracked].sort((a, b) =>
        brandName(a.advertiserId).localeCompare(brandName(b.advertiserId)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [untracked],
  );

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => setSort(k)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        sort === k
          ? "bg-[var(--brand)] text-white"
          : "border border-border bg-surface text-text-secondary hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );

  const BrandCell = ({ id }: { id: string }) => {
    const logo = getBrandLogo(id);
    return (
      <span className="flex items-center gap-2">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            loading="lazy"
            className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white sm:h-6 sm:w-6"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <span className="max-w-[150px] truncate sm:max-w-none">{brandName(id)}</span>
      </span>
    );
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Header: what's owed / paid to date, + sort control */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold">Payouts — what you&apos;re owed</h2>
          <div className="text-xs text-text-muted">
            Still owed{" "}
            <span className="font-semibold text-text-primary">{usd(totalOwed)}</span>
            <span className="mx-2 opacity-40">·</span>
            Paid to date{" "}
            <span className="font-semibold text-text-primary">{usd(totalPaid)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-text-muted">Sort</span>
          <SortButton k="owed" label="Still owed" />
          <SortButton k="paid" label="Paid out" />
          <SortButton k="name" label="A–Z" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 text-left font-medium">Brand</th>
              <th className="px-3 py-2 text-right font-medium">Paid out</th>
              <th className="px-3 py-2 text-right font-medium">Still owed</th>
              <th className="px-4 py-2 text-right font-medium">Last payout</th>
            </tr>
          </thead>
          <tbody>
            {sortedTracked.map((p) => (
              <tr key={p.advertiserId} className="border-t border-border">
                <td className="px-4 py-2 font-medium">
                  <BrandCell id={p.advertiserId} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{usd(p.paid)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{usd(p.outstanding)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-text-secondary">
                  {payoutDate(p.lastPayout)}
                </td>
              </tr>
            ))}

            {/* Divider before the can't-be-tracked group */}
            {sortedUntracked.length > 0 && sortedTracked.length > 0 && (
              <tr className="border-t border-border">
                <td colSpan={4} className="bg-surface-2 px-4 py-1.5 text-[11px] uppercase tracking-wide text-text-muted">
                  Can&apos;t be tracked
                </td>
              </tr>
            )}

            {sortedUntracked.map((p) => (
              <tr key={p.advertiserId} className="border-t border-border">
                <td className="px-4 py-2 font-medium text-text-secondary">
                  <BrandCell id={p.advertiserId} />
                </td>
                <td colSpan={3} className="px-4 py-2 text-right text-xs italic text-text-muted">
                  Platform doesn&apos;t report payout status
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-text-muted">
        These are <span className="font-medium text-text-secondary">current balances</span>, not
        date-filtered — affiliate programs pay on a cycle, so &quot;still owed&quot; is approved
        commission that hasn&apos;t been paid out yet.{" "}
        <span className="font-medium text-text-secondary">{tracked.length}</span> of {payouts.length}{" "}
        brands expose payout status (SocialSnowball). The rest pay outside the platform or don&apos;t
        report it, so we can&apos;t split paid vs. owed. &quot;Last payout&quot; fills in after each
        brand&apos;s next scrape.
      </p>
    </section>
  );
}
