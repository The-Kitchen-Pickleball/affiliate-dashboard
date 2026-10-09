"use client";

import { type Season } from "@/lib/brandProfiles";
import { todayCentral } from "@/lib/analytics";

/** Quick season filters on a brand's page (e.g. Honcho's registration seasons).
 *  Picking one sets the page's custom date range; picking it again clears it. */
export function SeasonFilter({
  seasons,
  customStart,
  customEnd,
  onPick,
  onClear,
}: {
  seasons: Season[];
  customStart: string | null;
  customEnd: string | null;
  onPick: (start: string, end: string) => void;
  onClear: () => void;
}) {
  const today = todayCentral();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-muted">Season:</span>
      {seasons.map((s) => {
        const end = s.end ?? today;
        const active = customStart === s.start && customEnd === end;
        return (
          <button
            key={s.label}
            onClick={() => (active ? onClear() : onPick(s.start, end))}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              active ? "border-[var(--brand)] text-[var(--brand)]" : "border-border text-text-secondary hover:bg-surface-2"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
