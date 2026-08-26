"use client";

import { useEffect, useState } from "react";

/** Light/dark toggle. Persists the choice to localStorage and sets `data-theme`
 *  on <html>. With no stored choice, follows the OS preference. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {}
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(sysDark ? "dark" : "light");
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm hover:bg-surface-2"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
