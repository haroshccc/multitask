import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Mic } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recordings: Recording[];
  selectedId: string | null;
  onSelect: (recordingId: string) => void;
  /** Total count, used in the closed state count badge. */
  totalCount?: number;
}

/**
 * Mobile recordings selector. Closed state shows the currently-playing
 * recording; tapping the chevron opens a panel above (drops down) with up to
 * 4 visible items at a time, the rest scroll. Picking an item closes the
 * panel and selects it.
 *
 * Used only below `lg` — desktop keeps the always-on aside list.
 */
export function RecordingsMobileDropdown({
  recordings,
  selectedId,
  onSelect,
  totalCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selected =
    recordings.find((r) => r.id === selectedId) ?? recordings[0] ?? null;

  const visibleCount = totalCount ?? recordings.length;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — shows the active recording's title, opens the panel */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full text-start rounded-lg border bg-white px-3 py-2.5",
          "flex items-center justify-between gap-2",
          "border-ink-300 hover:border-ink-400"
        )}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Mic className="w-4 h-4 text-ink-500 shrink-0" />
          <span className="text-sm text-ink-900 truncate">
            {selected ? selected.title || "ללא כותרת" : "אין הקלטות"}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 shrink-0 text-[11px] text-ink-500">
          {visibleCount > 0 && <span>{visibleCount}</span>}
          {open ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-30 top-full mt-1 inset-x-0",
            "bg-white border border-ink-200 rounded-lg shadow-lift",
            "overflow-hidden"
          )}
        >
          {recordings.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-ink-500">
              אין הקלטות
            </div>
          ) : (
            <ul
              // ~4 rows visible, the rest scroll.
              className="max-h-[200px] overflow-y-auto scrollbar-thin"
            >
              {recordings.map((r) => {
                const isActive = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(r.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full text-start px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary-50 text-primary-900 font-medium"
                          : "text-ink-800 hover:bg-ink-50"
                      )}
                    >
                      <span className="block truncate">
                        {r.title || "ללא כותרת"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
