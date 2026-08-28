"use client";

import { useEffect, useState } from "react";
import { getBrandProfile } from "@/lib/brandProfiles";

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  Connected: { dot: "var(--good)", label: "Connected" },
  "Manual Process": { dot: "#eab308", label: "Manual process" },
  Disconnected: { dot: "var(--bad)", label: "Disconnected" },
};

function Field({ label, value, href, children }: { label: string; value?: string | null; href?: string; children?: React.ReactNode }) {
  if (!children && !value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="truncate text-sm font-medium">
        {children ??
          (href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: "var(--brand)" }}>
              <span className="truncate">{value}</span>
              <span aria-hidden className="text-[10px] opacity-60">↗</span>
            </a>
          ) : (
            value
          ))}
      </div>
    </div>
  );
}

function CopyButton({ getText, title }: { getText: () => string | null; title: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        const t = getText();
        if (!t) return;
        try {
          await navigator.clipboard.writeText(t);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
      className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-2"
    >
      {done ? "✓" : "Copy"}
    </button>
  );
}

export function BrandProfile({ advertiserId, advertiser, onBack }: { advertiserId: string; advertiser: string; onBack?: () => void }) {
  const p = getBrandProfile(advertiserId);
  const [creds, setCreds] = useState<{ email: string | null; password: string | null } | null>(null);
  const [reveal, setReveal] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let live = true;
    fetch(`/api/credentials?brand=${encodeURIComponent(advertiserId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setCreds(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [advertiserId]);

  if (!p) return null;
  const status = p.connected ? STATUS_STYLE[p.connected] : null;
  const pct = p.commissionPct != null ? `${(p.commissionPct * 100).toFixed((p.commissionPct * 100) % 1 ? 1 : 0)}%` : "—";
  const codeText = p.code && p.code !== "NA" ? p.code + (p.discount ? ` · ${p.discount}` : "") : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Header — back button (left), name, status; clicking the row toggles collapse */}
      <div
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-surface-2"
      >
        {onBack && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            aria-label="All brands"
            className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium text-text-secondary hover:bg-surface-2"
          >
            ←<span className="hidden sm:inline"> All brands</span>
          </button>
        )}
        <h2 className="text-base font-semibold">{advertiser}</h2>
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: status.dot }} />
            <span className="hidden sm:inline">{status.label}</span>
          </span>
        )}
        <span
          aria-hidden
          className="ml-auto px-1 text-xs text-text-muted transition-transform"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          ▾
        </span>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {/* Platform on the left, affiliate login on the right */}
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-border pb-3">
            <Field label="Platform" value={p.platform} href={p.platformUrl} />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Affiliate Login</div>
              <div className="mt-0.5 flex flex-col gap-1 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="truncate">{creds?.email ?? (creds === null ? "…" : "not set")}</span>
                  {creds?.email && <CopyButton getText={() => creds.email} title="Copy email" />}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="tabular-nums tracking-wider">
                    {creds?.password ? (reveal ? creds.password : "••••••••") : creds === null ? "…" : "not set"}
                  </span>
                  {creds?.password && (
                    <>
                      <button type="button" onClick={() => setReveal((v) => !v)} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-2">
                        {reveal ? "Hide" : "Show"}
                      </button>
                      <CopyButton getText={() => creds.password} title="Copy password" />
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-3 pt-3">
            <Field label="Our Commission" value={pct} />
            <Field label="Code (buyer discount)">
              {codeText ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="tabular-nums">{codeText}</span>
                  <CopyButton getText={() => p.code ?? null} title="Copy code" />
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Field>
            <Field label="Store Link" value={p.storeLink ? "Visit store" : undefined} href={p.storeLink} />
          </div>

          {p.notes && <p className="mt-3 text-xs text-text-muted">{p.notes}</p>}
        </div>
      )}
    </div>
  );
}
