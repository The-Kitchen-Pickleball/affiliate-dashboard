"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        const from = params.get("from") || "/";
        window.location.href = from.startsWith("/") ? from : "/";
      } else {
        setError(true);
        setLoading(false);
      }
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="mb-5 flex justify-center" style={{ color: "var(--logo)" }}>
          <Logo className="h-10 w-auto" />
        </div>
        <h1 className="mb-1 text-center text-sm font-semibold">Affiliate Dashboard</h1>
        <p className="mb-4 text-center text-xs text-text-muted">Enter the password to continue</p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-[var(--brand)]"
        />

        {error && <p className="mt-2 text-xs text-[var(--bad)]">Incorrect password. Try again.</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-[var(--brand-ink)] disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
