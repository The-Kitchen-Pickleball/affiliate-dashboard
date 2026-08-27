"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResponse, Status } from "@/lib/types";
import type { RangePreset } from "@/lib/analytics";
import {
  applyNonDateFilters,
  byBrandDetailed,
  daily,
  lastNDaysRange,
  monthly,
  monthRange,
  rangeFor,
  previousRange,
  previousRangeCustom,
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
import { AveragesSection } from "./AveragesSection";

const COMPARISON_LABEL: Record<RangePreset, string> = {
  today: "vs yesterday",
  "7d": "vs prev 7 days",
  "30d": "vs prev 30 days",
  "90d": "vs prev 90 days",
  wtd: "vs last week",
  mtd: "vs last month",
  ytd: "vs prev period",
  all: "all time",
};

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

  const loadData = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch("/api/data", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e.error))))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filters = { preset, advertisers, statuses };

  const view = useMemo(() => {
    if (!data) return null;
    const all = applyNonDateFilters(data.rows, filters); // every status
    // Declined commissions were rejected by the platform — exclude them from all
    // headline numbers, brand table, trend, and averages. They're only surfaced
    // in the status breakdown below.
    const active = all.filter((r) => r.status !== "declined");

    // A custom range overrides the preset; otherwise use the preset window.
    const custom = Boolean(customStart && customEnd);
    const { start, end } = custom
      ? { start: customStart as string, end: customEnd as string }
      : rangeFor(preset);
    const prev = custom ? previousRangeCustom(start, end) : previousRange(preset);
    const comparisonLabel = custom ? "vs prev period" : COMPARISON_LABEL[preset];
    const periodLabel =
      !custom && preset === "all"
        ? "All time"
        : start === end
          ? shortDate(start)
          : `${shortDate(start)} – ${shortDate(end)}`;

    const inRange = (r: { date: string }) => r.date >= start && r.date <= end;
    const inWindow = active.filter(inRange); // approved + pending only
    const cur = totals(inWindow);
    const prevTotals = prev
      ? totals(active.filter((r) => r.date >= prev.start && r.date <= prev.end))
      : null;

    // Status breakdown for the selected window (includes declined).
    const windowAll = all.filter(inRange);
    const statusTotals = {
      approved: totals(windowAll.filter((r) => r.status === "approved")),
      pending: totals(windowAll.filter((r) => r.status === "pending")),
      declined: totals(windowAll.filter((r) => r.status === "declined")),
    };

    // Averages over the selected window.
    const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1);
    const avg = {
      salePerOrder: cur.count ? cur.sales / cur.count : 0,
      commPerOrder: cur.count ? cur.commission / cur.count : 0,
      salePerDay: cur.sales / days,
      commPerDay: cur.commission / days,
      days,
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

    return {
      cur,
      avg,
      pace,
      statusTotals,
      dow: byDayOfWeek(inWindow), // weekday averages for the selected period
      periodLabel,
      prevTotals,
      comparisonLabel,
      nonDate: active, // trend derives from this (declined excluded)
      brands: byBrandDetailed(windowAll),
      allBrands: [...new Map(data.rows.map((r) => [r.advertiserId, r.advertiser])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, preset, customStart, customEnd, advertisers, statuses]);

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
      <header className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="justify-self-start" style={{ color: "var(--logo)" }}>
          <Logo className="h-9 w-auto sm:h-10" />
        </span>
        <div className="min-w-0 justify-self-center text-center">
          <h1 className="text-sm font-semibold leading-tight sm:text-base">Affiliate Dashboard</h1>
          {data?.lastScrape && (
            <p className="truncate text-xs text-text-muted">
              <span className="sm:hidden">Updated {heartbeatShort(data.lastScrape)}</span>
              <span className="hidden sm:inline">Updated {heartbeatLabel(data.lastScrape)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 justify-self-end">
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
        </div>
      </header>

      {/* Filters */}
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

      {!view ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          {/* KPIs — 3 across on every screen, compact on mobile */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <KpiCard
              label="Total Sales"
              value={usd(view.cur.sales)}
              current={view.cur.sales}
              previous={view.prevTotals?.sales ?? null}
              comparisonLabel={view.comparisonLabel}
            />
            <KpiCard
              label="Total Commission"
              value={usd(view.cur.commission)}
              current={view.cur.commission}
              previous={view.prevTotals?.commission ?? null}
              comparisonLabel={view.comparisonLabel}
            />
            <KpiCard
              label="# of Sales"
              value={num(view.cur.count)}
              current={view.cur.count}
              previous={view.prevTotals?.count ?? null}
              comparisonLabel={view.comparisonLabel}
            />
          </div>

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
              <StatusStat label="Approved" value={view.statusTotals.approved.commission} color="var(--good)" />
              <StatusStat label="Pending" value={view.statusTotals.pending.commission} color="var(--text-muted)" />
              {view.statusTotals.declined.commission > 0 && (
                <StatusStat label="Declined" value={view.statusTotals.declined.commission} color="var(--bad)" muted />
              )}
            </div>
          </div>

          {/* Brand list first (per Dane), then the trend graph */}
          <BrandTable rows={view.brands} />

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
          <AveragesSection avg={view.avg} dow={view.dow} periodLabel={view.periodLabel} />
        </div>
      )}
    </div>
  );
}

function StatusStat({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: number;
  color: string;
  muted?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className={`font-semibold tabular-nums ${muted ? "text-text-muted" : ""}`}>{usd(value)}</span>
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
