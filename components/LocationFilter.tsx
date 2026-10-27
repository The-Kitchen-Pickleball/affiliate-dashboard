"use client";

/** Store/location chips on a brand's page (e.g. Six Zero: USA / Canada / International).
 *  Picking one narrows the page to that store; picking it again shows all. */
export function LocationFilter({
  locations,
  selected,
  onPick,
}: {
  locations: string[];
  selected: string | null;
  onPick: (l: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-muted">Location:</span>
      {["All", ...locations].map((l) => {
        const active = l === "All" ? selected === null : selected === l;
        return (
          <button
            key={l}
            onClick={() => onPick(l === "All" || active ? null : l)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              active ? "border-[var(--brand)] text-[var(--brand)]" : "border-border text-text-secondary hover:bg-surface-2"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
