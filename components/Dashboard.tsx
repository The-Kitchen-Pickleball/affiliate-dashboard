"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResponse, Status } from "@/lib/types";
import type { RangePreset } from "@/lib/analytics";
import { CONTRACT_STARTS, BRAND_SEASONS } from "@/lib/brandProfiles";
import {
  applyNonDateFilters,
  byBrandDetailed,
  daily,
  lastNDaysRange,
  monthly,
  monthRange,
  rangeFor,
  addDays,
  todayCentral,
  totals,
} from "@/lib/analytics";
import { usd, num, monthLabel, shortDate, heartbeatLabel, heartbeatShort, pctChange } from "@/lib/format";
import { byDayOfWeek } from "@/lib/analytics";
import { KpiCard } from "./KpiCard";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Filters } from "./Filters";
import { TrendChart, type Granularity, type TrendPoint } from "./TrendChart";
import { BrandTable } from "./BrandTable";
import { BrandProfile } from "./BrandProfile";
import { api } from "@/lib/basePath";
import { SeasonFilter } from "./SeasonFilter";
import { PayoutsView } from "./PayoutsView";
import { HealthReportModal } from "./HealthReportModal";
import { AveragesSection } from "./AveragesSection";


type Metric = "commission" | "sales" | "count";

export function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("today");
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const statuses: Status[] = []; // status filtering removed from UI — always include all
  const [metric, setMetric] = useState<Metric>("commission");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [trendRange, setTrendRange] = useState<number>(30); // trend's own daily lookback
  // A custom date range overrides the preset when both are set.
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  // Dismissed health warnings (per-browser, remembered). Errors can't be dismissed.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashHealthDismissed");
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  const toggleDismiss = useCallback((id: string, on: boolean) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem("dashHealthDismissed", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);
  // Top-level tab: the date-filtered "Sales" dashboard, or the "Payouts" standing
  // (lifetime balances — kept separate because they don't respond to the date filter).
  const [tab, setTab] = useState<"sales" | "payouts">("sales");
  // Payouts is still being built — warn every time someone opens it (Dane, 2026-10-10).
  const [payoutsNotice, setPayoutsNotice] = useState(false);
  // Mobile nav (hamburger) open state.
  const [navOpen, setNavOpen] = useState(false);
  // Which brand's detail page we're viewing (null = overview). Synced to ?brand=.
  const [brand, setBrand] = useState<string | null>(null);

  // Initialise from the URL and keep in sync with the browser back/forward buttons.
  useEffect(() => {
    const read = () => setBrand(new URLSearchParams(window.location.search).get("brand"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const selectBrand = useCallback((id: string | null) => {
    setBrand(id);
    const url = id ? `?brand=${encodeURIComponent(id)}` : window.location.pathname;
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Clicking the logo does a full refresh back to the default home view —
  // reloads the page (fresh data) and clears any ?brand / filters via the URL.
  const resetAll = useCallback(() => {
    window.location.assign("/");
  }, []);

  // Switch top-level view (Sales / Payouts). Leaves any brand drill-in and closes
  // the mobile menu.
  const goTab = useCallback(
    (key: "sales" | "payouts") => {
      setBrand((b) => {
        if (b) {
          window.history.pushState({}, "", window.location.pathname);
          return null;
        }
        return b;
      });
      setTab(key);
      if (key === "payouts") setPayoutsNotice(true);
      setNavOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  const loadData = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch(api("/api/data"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e.error))))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When viewing a brand's detail page, scope every number to just that brand.
  const filters = { preset, advertisers: brand ? [brand] : advertisers, statuses };

  const view = useMemo(() => {
    if (!data) return null;
    const allRows = applyNonDateFilters(data.rows, filters); // every status
    // "Since contract": keep each brand's rows from ITS contract start onward;
    // brands with no contract on file (commission-only) drop out of this view.
    const contractMode = preset === "contract" && !(customStart && customEnd);
    const all = contractMode
      ? allRows.filter((r) => {
          const s = CONTRACT_STARTS[r.advertiserId];
          return Boolean(s) && r.date >= s;
        })
      : allRows;
    // Declined commissions were rejected by the platform — exclude them from all
    // headline numbers, brand table, trend, and averages. They're only surfaced
    // in the status breakdown below.
    const active = all.filter((r) => r.status !== "declined");

    // A custom range overrides the preset; otherwise use the preset window.
    const custom = Boolean(customStart && customEnd);
    const { start, end } = custom
      ? { start: customStart as string, end: customEnd as string }
      : rangeFor(preset);
    const periodLabel =
      !custom && preset === "all"
        ? "All time"
        : contractMode
          ? "Since contract start"
        : start === end
          ? shortDate(start)
          : `${shortDate(start)} – ${shortDate(end)}`;

    const inRange = (r: { date: string }) => r.date >= start && r.date <= end;
    const inWindow = active.filter(inRange); // approved + pending only
    const cur = totals(inWindow);

    // Status breakdown for the selected window (includes declined).
    const windowAll = all.filter(inRange);
    const statusTotals = {
      approved: totals(windowAll.filter((r) => r.status === "approved")),
      pending: totals(windowAll.filter((r) => r.status === "pending")),
      declined: totals(windowAll.filter((r) => r.status === "declined")),
    };

    // Nominal period length (days elapsed) — used only for the on-pace projection.
    const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1);
    // Denominator for the per-day averages: the ACTUAL span of data in the window
    // (first sale → last sale). Using the nominal range broke "All time", whose
    // range starts decades ago and produced a nonsensical ~9700-day denominator.
    let avgDays = 1;
    if (inWindow.length) {
      const ds = inWindow.map((r) => r.date.slice(0, 10));
      const lo = ds.reduce((a, b) => (b < a ? b : a));
      const hi = ds.reduce((a, b) => (b > a ? b : a));
      avgDays = Math.max(1, Math.round((Date.parse(hi) - Date.parse(lo)) / 86_400_000) + 1);
    }
    const avg = {
      salePerOrder: cur.count ? cur.sales / cur.count : 0,
      commPerOrder: cur.count ? cur.commission / cur.count : 0,
      salePerDay: cur.sales / avgDays,
      commPerDay: cur.commission / avgDays,
      days: avgDays,
    };

    // "On pace" projection — only for to-date periods still in progress.
    let pace: { label: string; sales: number; commission: number } | null = null;
    if (!custom && (preset === "wtd" || preset === "mtd" || preset === "ytd")) {
      const [yy, mm] = end.split("-").map(Number);
      const totalDays =
        preset === "wtd"
          ? 7
          : preset === "mtd"
            ? new Date(yy, mm, 0).getDate()
            : (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0
              ? 366
              : 365;
      if (days < totalDays && days > 0) {
        const factor = totalDays / days;
        const label = preset === "wtd" ? "this week" : preset === "mtd" ? "this month" : "this year";
        pace = { label, sales: cur.sales * factor, commission: cur.commission * factor };
      }
    }

    // KPI % = this period's per-day rate vs the average day over the 30 days
    // BEFORE the period (Dane, 2026-10-08: "vs yesterday" swung wildly and a
    // part-finished today always looked down). Single day compares its total;
    // multi-day compares its per-day average. No comparison for All time /
    // Since contract (there's no meaningful "before").
    // Only a single day gets a % (Dane, 2026-10-08): for a range, the total + per-day
    // average already answer "what happened"; a comparison needed explaining.
    const noCompare = start !== end || (!custom && (preset === "all" || preset === "contract"));
    const baseStart = addDays(start, -30);
    const baseEnd = addDays(start, -1);
    const base = noCompare ? null : totals(active.filter((r) => r.date >= baseStart && r.date <= baseEnd));
    const baselinePerDay = base ? { sales: base.sales / 30, commission: base.commission / 30, count: base.count / 30 } : null;
    const currentPerDay =
      start === end
        ? { sales: cur.sales, commission: cur.commission, count: cur.count }
        : { sales: avg.salePerDay, commission: avg.commPerDay, count: cur.count / avg.days };
    const comparisonLabel = noCompare ? "" : "vs avg day, past 30 days";

    return {
      cur,
      avg,
      currentPerDay,
      baselinePerDay,
      // Per-day averages only mean something across more than one day.
      multiDay: start !== end,
      pace,
      statusTotals,
      dow: byDayOfWeek(inWindow), // weekday averages for the selected period
      periodLabel,
      comparisonLabel,
      nonDate: active, // trend derives from this (declined excluded)
      brands: byBrandDetailed(windowAll),
      allBrands: [...new Map(data.rows.map((r) => [r.advertiserId, r.advertiser])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, preset, customStart, customEnd, advertisers, statuses, brand]);

  const brandName =
    brand && data ? data.rows.find((r) => r.advertiserId === brand)?.advertiser ?? brand : null;

  // Derive the chart series — INDEPENDENT of the page date filter. Daily uses its
  // own lookback (trendRange); monthly shows the last 12 months.
  const trendData: TrendPoint[] = useMemo(() => {
    if (!view) return [];
    if (granularity === "month") {
      const curMonth = todayCentral().slice(0, 7);
      const rows = monthly(view.nonDate, 12);
      return rows.map((m, i) => {
        const prev = i > 0 ? rows[i - 1] : null;
        return {
          key: m.month,
          label: monthLabel(m.month),
          commission: m.commission,
          sales: m.sales,
          count: m.count,
          current: m.month === curMonth,
          deltaPct: prev ? pctChange(m[metric], prev[metric]) : null,
        };
      });
    }
    const { start, end } = lastNDaysRange(trendRange);
    const days = daily(
      view.nonDate.filter((r) => r.date >= start && r.date <= end),
      start,
      end,
    );
    return days.map((d) => ({
      key: d.date,
      label: shortDate(d.date),
      commission: d.commission,
      sales: d.sales,
      count: d.count,
    }));
  }, [view, granularity, trendRange, metric]);

  // Shared value font size for the KPI cards AND the Approved/Pending/Declined
  // status numbers, so they always match. Sized to fit the longest KPI value:
  // big totals shrink a step, shorter ones render larger. (Approved/Pending are
  // ≤ the commission KPI in length, so the KPI-derived size always fits them.)
  const kpiSize = view
    ? (() => {
        const vals = [usd(view.cur.sales), usd(view.cur.commission), num(view.cur.count)];
        const d = Math.max(...vals.map((v) => v.replace(/[^0-9]/g, "").length));
        return d >= 9 ? "text-sm sm:text-2xl" : d >= 7 ? "text-base sm:text-3xl" : "text-lg sm:text-3xl";
      })()
    : "text-lg sm:text-3xl";

  if (error) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-[var(--bad)]">Couldn&apos;t load data: {error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
      {/* Header */}
      <header className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          onClick={resetAll}
          className="justify-self-start"
          style={{ color: "var(--logo)" }}
          title="Reset dashboard"
          aria-label="Reset dashboard"
        >
          <Logo className="h-9 w-auto sm:h-10" />
        </button>
        <div className="min-w-0 justify-self-center text-center">
          <h1 className="text-sm font-semibold leading-tight sm:text-base">Affiliate Dashboard</h1>
          {data?.lastScrape && (
            <p className="truncate text-xs text-text-muted">
              <span className="sm:hidden">Updated {heartbeatShort(data.lastScrape)}</span>
              <span className="hidden sm:inline">Updated {heartbeatLabel(data.lastScrape)}</span>
            </p>
          )}
          {data &&
            (() => {
              const problems = data.checks.filter((c) => c.status !== "ok" && !(c.dismissId && dismissed.has(c.dismissId)));
              const err = problems.some((c) => c.status === "error");
              const color = problems.length === 0 ? "var(--good)" : err ? "var(--bad)" : "#eab308";
              const label =
                problems.length === 0
                  ? "✓ All systems healthy"
                  : `${err ? "🚨" : "⚠"} ${problems.length} thing${problems.length > 1 ? "s" : ""} to review`;
              return (
                <button
                  onClick={() => setShowHealth(true)}
                  className="text-[11px] font-medium underline decoration-dotted underline-offset-2 hover:opacity-80"
                  style={{ color }}
                  title="View health report"
                >
                  {label}
                </button>
              );
            })()}
        </div>
        <div className="flex items-center gap-1 justify-self-end sm:gap-2">
          {/* Desktop nav links */}
          <nav className="mr-1 hidden items-center gap-1 sm:flex">
            {([
              ["sales", "Sales"],
              ["payouts", "Payouts"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => goTab(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === key ? "text-[var(--brand)]" : "text-text-secondary hover:bg-surface-2"
                }`}
              >
                {label}
              </button>
            ))}
            {/* Other sections of dashboard.thekitchenpickle.com (kitchen-social app). */}
            {([
              ["/partners", "Partners"],
              ["/series", "Series"],
            ] as const).map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-2"
              >
                {label}
              </a>
            ))}
          </nav>
          <button
            onClick={loadData}
            disabled={refreshing}
            aria-label="Refresh data"
            title="Refresh data"
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xl leading-none hover:bg-surface-2 disabled:opacity-50"
          >
            <span className="inline-block" style={{ animation: refreshing ? "spin 0.8s linear infinite" : undefined }}>
              ↻
            </span>
          </button>
          <ThemeToggle />
          {/* Mobile hamburger */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={navOpen}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xl leading-none hover:bg-surface-2"
            >
              {navOpen ? "✕" : "☰"}
            </button>
            {navOpen && (
              <>
                {/* click-away backdrop */}
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setNavOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                  {([
                    ["sales", "Sales"],
                    ["payouts", "Payouts"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => goTab(key)}
                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition ${
                        tab === key ? "bg-surface-2 text-[var(--brand)]" : "text-text-secondary hover:bg-surface-2"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {([
                    ["/partners", "Partners"],
                    ["/series", "Series"],
                  ] as const).map(([href, label]) => (
                    <a
                      key={href}
                      href={href}
                      onClick={() => setNavOpen(false)}
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-text-secondary transition hover:bg-surface-2"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Filters — only on the Sales tab (Payouts is a lifetime standing, not date-filtered) */}
      {tab === "sales" && (
      <div className="mb-5">
        <Filters
          preset={preset}
          onPreset={setPreset}
          advertisers={view?.allBrands ?? []}
          selectedAdvertisers={advertisers}
          onAdvertisers={setAdvertisers}
          customStart={customStart}
          customEnd={customEnd}
          onCustomRange={(s, e) => {
            setCustomStart(s);
            setCustomEnd(e);
          }}
          onClearCustom={() => {
            setCustomStart(null);
            setCustomEnd(null);
          }}
        />
      </div>
      )}

      {tab === "payouts" && payoutsNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setPayoutsNotice(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm animate-fade-in rounded-2xl border border-border bg-surface p-5 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-2xl" aria-hidden>🚧</div>
            <h3 className="text-base font-semibold">Still Under Development</h3>
            <p className="mt-1 text-sm text-text-secondary">Data is not accurate yet.</p>
            <button
              autoFocus
              onClick={() => setPayoutsNotice(false)}
              className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium"
              style={{ background: "var(--brand)", color: "#0b0f0c" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {tab === "payouts" ? (
        data ? (
          <PayoutsView
            payouts={data.payouts}
            brandName={(id) => data.rows.find((r) => r.advertiserId === id)?.advertiser ?? id}
          />
        ) : (
          <LoadingSkeleton />
        )
      ) : !view ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Brand detail: profile card (with its own back button), on a brand page */}
          {brand && <BrandProfile advertiserId={brand} advertiser={brandName ?? brand} onBack={() => selectBrand(null)} />}
          {brand && BRAND_SEASONS[brand] && (
            <SeasonFilter
              seasons={BRAND_SEASONS[brand]}
              customStart={customStart}
              customEnd={customEnd}
              onPick={(s, e) => {
                setCustomStart(s);
                setCustomEnd(e);
              }}
              onClear={() => {
                setCustomStart(null);
                setCustomEnd(null);
              }}
            />
          )}

          {/* KPIs — 3 across on every screen, compact on mobile. All three share
              one font size (kpiSize, hoisted above) picked to fit the longest
              value, and the Approved/Pending numbers below use the same size. */}
          {(() => {
            const vals = [usd(view.cur.sales), usd(view.cur.commission), num(view.cur.count)];
            return (
              <div className="grid grid-cols-[1.25fr_1.25fr_1fr] gap-2 sm:grid-cols-3 sm:gap-3">
                <KpiCard
                  label="Total Sales"
                  value={vals[0]}
                  perDay={view.multiDay ? usd(view.avg.salePerDay) : undefined}
                  current={view.currentPerDay.sales}
                  previous={view.baselinePerDay?.sales ?? null}
                  comparisonLabel={view.comparisonLabel}
                  comparisonLabelShort={view.comparisonLabel ? "vs 30d avg" : undefined}
                  valueSize={kpiSize}
                />
                <KpiCard
                  label="Total Commission"
                  value={vals[1]}
                  perDay={view.multiDay ? usd(view.avg.commPerDay) : undefined}
                  current={view.currentPerDay.commission}
                  previous={view.baselinePerDay?.commission ?? null}
                  comparisonLabel={view.comparisonLabel}
                  comparisonLabelShort={view.comparisonLabel ? "vs 30d avg" : undefined}
                  valueSize={kpiSize}
                />
                <KpiCard
                  label="# of Sales"
                  value={vals[2]}
                  perDay={view.multiDay ? (view.cur.count / view.avg.days).toFixed(1) : undefined}
                  current={view.currentPerDay.count}
                  previous={view.baselinePerDay?.count ?? null}
                  comparisonLabel={view.comparisonLabel}
                  comparisonLabelShort={view.comparisonLabel ? "vs 30d avg" : undefined}
                  valueSize={kpiSize}
                />
              </div>
            );
          })()}

          {/* On-pace projection + commission status breakdown */}
          <div className="rounded-xl border border-border bg-surface p-4">
            {view.pace && (
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2 border-b border-border pb-3 text-sm">
                <span aria-hidden>📈</span>
                <span className="text-text-secondary">On pace for</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
                  {usd(view.pace.commission)}
                </span>
                <span className="text-text-secondary">commission {view.pace.label}</span>
                <span className="text-text-muted">· ~{usd(view.pace.sales)} sales</span>
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <StatusStat label="Approved" value={view.statusTotals.approved.commission} color="var(--good)" size={kpiSize} />
              <StatusStat label="Pending" value={view.statusTotals.pending.commission} color="var(--text-muted)" size={kpiSize} />
              {view.statusTotals.declined.commission > 0 && (
                <StatusStat label="Declined" value={view.statusTotals.declined.commission} color="var(--bad)" size={kpiSize} muted />
              )}
            </div>
          </div>

          {/* Brand list first (per Dane), then the trend graph. In a brand view this
              is just that one brand — still handy for its transaction drill-down. */}
          <BrandTable rows={view.brands} onSelectBrand={brand ? undefined : selectBrand} singleBrand={!!brand} />

          <TrendChart
            data={trendData}
            metric={metric}
            onMetric={setMetric}
            granularity={granularity}
            onGranularity={setGranularity}
            range={trendRange}
            onRange={setTrendRange}
            onSelect={(p) => {
              // Drill the whole page into the clicked day (daily) or month (monthly).
              const r = granularity === "month" ? monthRange(p.key) : { start: p.key, end: p.key };
              setCustomStart(r.start);
              setCustomEnd(r.end);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />

          {/* Averages — below the trend (per Dane), always expanded */}
          {view.multiDay && <AveragesSection dow={view.dow} />}
        </div>
      )}

      {showHealth && data && (
        <HealthReportModal
          checks={data.checks}
          lastScrape={data.lastScrape}
          dismissed={dismissed}
          onToggleDismiss={toggleDismiss}
          onClose={() => setShowHealth(false)}
        />
      )}
    </div>
  );
}

function StatusStat({
  label,
  value,
  color,
  size,
  muted,
}: {
  label: string;
  value: number;
  color: string;
  size: string; // shared KPI value font size so status numbers match the KPIs
  muted?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className={`font-semibold tabular-nums ${size} ${muted ? "text-text-muted" : ""}`}>{usd(value)}</span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
    </div>
  );
}
