import { useState } from "react";
import { Columns3, Eye, EyeOff } from "lucide-react";

export interface ColumnsMenuItem {
  /** Fixed column key or custom field id. */
  id: string;
  label: string;
  kind: "fixed" | "custom";
}

/**
 * "עמודות" popover for a configurable table: lists every column (fixed +
 * custom) with an eye toggle that hides/shows it WITHOUT deleting data.
 * Visibility is stored per-project (see useEntityColumnVisibility) and only
 * affects the project tables, not the global Gantt. The last visible column
 * can't be hidden so the table never goes fully empty.
 */
export function ColumnsMenu({
  items,
  hiddenIds,
  onToggle,
}: {
  items: ColumnsMenuItem[];
  hiddenIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const visibleCount = items.filter((it) => !hiddenIds.has(it.id)).length;
  const hiddenCount = items.length - visibleCount;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
        title="הצגת/הסתרת עמודות"
        aria-label="עמודות"
      >
        <Columns3 className="w-3.5 h-3.5" />
        עמודות
        {hiddenCount > 0 && (
          <span className="text-[10px] text-ink-400">({hiddenCount} מוסתרות)</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-2 w-60 max-h-80 overflow-y-auto">
            <h4 className="text-xs font-semibold text-ink-900 px-2 py-1">
              עמודות בטבלה
            </h4>
            <ul className="space-y-0.5">
              {items.map((it) => {
                const hidden = hiddenIds.has(it.id);
                // Don't let the user hide the last remaining column.
                const blocked = !hidden && visibleCount <= 1;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => onToggle(it.id)}
                      className={
                        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition-colors " +
                        (blocked
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-ink-100") +
                        (hidden ? " text-ink-400" : " text-ink-800")
                      }
                      title={
                        blocked
                          ? "חייבת להישאר לפחות עמודה אחת"
                          : hidden
                          ? "הצגת העמודה"
                          : "הסתרת העמודה"
                      }
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {it.label}
                        {it.kind === "custom" && (
                          <span className="text-[9px] text-ink-300">מותאמת</span>
                        )}
                      </span>
                      {hidden ? (
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 shrink-0 text-primary-600" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
