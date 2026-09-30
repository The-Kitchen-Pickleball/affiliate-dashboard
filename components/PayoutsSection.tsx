"use client";

import { usd } from "@/lib/format";
import { getBrandLogo } from "@/lib/brandLogos";
import type { PayoutRow } from "@/lib/types";

/**
 * "What you're owed" — per-brand paid vs. still-owed, for the brands whose
 * platform reports payout status. These are lifetime/current balances (not
 * date-ranged): affiliate programs pay on a cycle, so "owed" is the approved
 * commission that hasn't been paid out yet.
 */
export function PayoutsSection({
  payouts,
  brandName,
}: {
  payouts: PayoutRow[];
  brandName: (id: string) => string;
}) {
  if (!payouts.length) return null;

  const sorted = [...payouts].sort((a, b) => b.outstanding - a.outstanding);
  const totalOwed = payouts.reduce((s, p) => s + p.outstanding, 0);
  const totalPaid = payouts.reduce((s, p) => s + p.paid, 0);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Payouts — what you&apos;re owed</h2>
        <div className="text-xs text-text-muted">
          Still owed{" "}
          <span className="font-semibold text-text-primary">{usd(totalOwed)}</span>
          <span className="mx-2 opacity-40">·</span>
          Paid to date{" "}
          <span className="font-semibold text-text-primary">{usd(totalPaid)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 text-left font-medium">Brand</th>
              <th className="px-3 py-2 text-right font-medium">Paid out</th>
              <th className="px-4 py-2 text-right font-medium">Still owed</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const logo = getBrandLogo(p.advertiserId);
              return (
                <tr key={p.advertiserId} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">
                    <span className="flex items-center gap-2">
                      {logo && (
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
                      <span className="max-w-[140px] truncate sm:max-w-none">{brandName(p.advertiserId)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{usd(p.paid)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{usd(p.outstanding)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-text-muted">
        Current balances, not date-filtered. Only brands whose platform reports payout status appear
        here (SocialSnowball, plus UpPromote brands that mark commissions paid). Others (RPM, GoAffPro,
        JOOLA, etc.) don&apos;t expose paid-vs-owed, so they&apos;re not shown.
      </p>
    </section>
  );
}
