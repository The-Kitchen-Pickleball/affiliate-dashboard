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
      {done ? "✓ Copied" : "Copy"}
    </button>
  );
}

function LoginModal({
  advertiser,
  platformUrl,
  creds,
  onClose,
}: {
  advertiser: string;
  platformUrl?: string;
  creds: { email: string | null; password: string | null } | null;
  onClose: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-sm animate-fade-in rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{advertiser} · Affiliate login</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-0.5 text-text-muted hover:bg-surface-2">✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Login Email">
            {creds?.email ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="truncate">{creds.email}</span>
                <CopyButton getText={() => creds.email} title="Copy email" />
              </span>
            ) : (
              <span className="text-text-muted">{creds === null ? "…" : "not set"}</span>
            )}
          </Field>
          <Field label="Login Password">
            {creds?.password ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="tabular-nums tracking-wider">{reveal ? creds.password : "••••••••"}</span>
                <button type="button" onClick={() => setReveal((v) => !v)} title={reveal ? "Hide" : "Reveal"} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-2">
                  {reveal ? "Hide" : "Show"}
                </button>
                <CopyButton getText={() => creds.password} title="Copy password" />
              </span>
            ) : (
              <span className="text-text-muted">{creds === null ? "…" : "not set"}</span>
            )}
          </Field>
          {platformUrl && (
            <a href={platformUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: "var(--brand)", color: "var(--brand-ink)" }}>
              Open affiliate dashboard ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function BrandProfile({ advertiserId, advertiser, onBack }: { advertiserId: string; advertiser: string; onBack?: () => void }) {
  const p = getBrandProfile(advertiserId);
  const [creds, setCreds] = useState<{ email: string | null; password: string | null } | null>(null);
  const [open, setOpen] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

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
      {/* Header — clicking anywhere on this row collapses/expands the card.
          The Login and back buttons stop propagation so they don't toggle it. */}
      <div
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-surface-2"
      >
        <h2 className="text-base font-semibold">{advertiser}</h2>
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: status.dot }} />
            <span className="hidden sm:inline">{status.label}</span>
          </span>
        )}
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
          {/* Desktop: platform · login · commission · code · store all on one row.
              Mobile: platform + login on top, the rest as a 2-col grid below. */}
          <div className="mb-3 flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10">
            <div className="flex items-center gap-3">
              <Field label="Platform" value={p.platform} href={p.platformUrl} />
              <button
                onClick={() => setShowLogin(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-2"
                title="Show affiliate login"
              >
                🔑 Login
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:items-center sm:gap-x-10">
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
          </div>
          {p.notes && <p className="mt-3 text-xs text-text-muted">{p.notes}</p>}
        </div>
      )}

      {showLogin && <LoginModal advertiser={advertiser} platformUrl={p.platformUrl} creds={creds} onClose={() => setShowLogin(false)} />}
    </div>
  );
}
