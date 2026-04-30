import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RecordingFilters } from "@/components/recordings/RecordingFilters";
import { RecordingCard } from "@/components/recordings/RecordingCard";
import { useRecordingsPageCtx } from "./context";

/**
 * Right-side panel: collapsible filter banner on top, recordings list
 * directly below. Default state = filters CLOSED (just a thin header with
 * an active-count chip). Tapping the header expands the full filter UI;
 * the list below pushes down naturally.
 */
export function FiltersAndListWidget() {
  const ctx = useRecordingsPageCtx();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const recordings = ctx.filteredRecordings;
  const total = ctx.allRecordings.length;
  const hidden = total - recordings.length;

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <FiltersHeader
        open={filtersOpen}
        onToggle={() => setFiltersOpen((v) => !v)}
        activeCount={countActive(ctx)}
      />

      {filtersOpen && (
        <div className="border-b border-ink-200">
          <RecordingFilters
            filters={ctx.filters}
            onFiltersChange={ctx.setFilters}
            grouping={ctx.grouping}
            onGroupingChange={ctx.setGrouping}
            className="!shadow-none !border-0 !rounded-none"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1.5 scrollbar-thin">
        {ctx.isLoading ? (
          <p className="p-4 text-center text-xs text-ink-500">טוענת…</p>
        ) : total === 0 ? (
          <p className="p-4 text-center text-xs text-ink-500">
            עוד אין הקלטות. גררי קובץ או הקליטי ישירות.
          </p>
        ) : recordings.length === 0 ? (
          <FilteredEmpty
            total={total}
            hidden={hidden}
            onClear={ctx.clearAll}
          />
        ) : (
          recordings.map((r) => (
            <RecordingCard
              key={r.id}
              recording={r}
              isActive={r.id === ctx.selectedId}
              onSelect={() => ctx.setSelectedId(r.id)}
            />
          ))
        )}
      </div>

      <footer className="px-3 py-2 border-t border-ink-200 text-[11px] text-ink-500 flex items-center justify-between">
        <span>
          {recordings.length} מתוך {total}
        </span>
        {hidden > 0 && (
          <button
            type="button"
            onClick={ctx.clearAll}
            className="hover:text-ink-900 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            נקי סינון
          </button>
        )}
      </footer>
    </div>
  );
}

function FiltersHeader({
  open,
  onToggle,
  activeCount,
}: {
  open: boolean;
  onToggle: () => void;
  activeCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 border-b border-ink-200",
        "text-sm text-ink-700 hover:bg-ink-50 transition-colors",
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Filter className="w-3.5 h-3.5" />
        סינון
        {activeCount > 0 && (
          <span className="chip-accent !py-0 !px-1.5 !text-[10px]">
            {activeCount}
          </span>
        )}
      </span>
      {open ? (
        <ChevronUp className="w-4 h-4 text-ink-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-ink-500" />
      )}
    </button>
  );
}

function FilteredEmpty({
  total,
  hidden,
  onClear,
}: {
  total: number;
  hidden: number;
  onClear: () => void;
}) {
  return (
    <div className="p-3 text-center space-y-1">
      <p className="text-xs font-medium text-ink-800">אין הקלטות בסינון זה</p>
      <p className="text-[11px] text-ink-500">
        {hidden} מתוך {total} מוסתרות.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="btn-outline !py-1 !px-2 !text-[11px] mt-1"
      >
        נקי סינון
      </button>
    </div>
  );
}

function countActive(ctx: ReturnType<typeof useRecordingsPageCtx>): number {
  let n = 0;
  if (ctx.filters.search.trim()) n++;
  if (ctx.filters.includeArchived) n++;
  if (ctx.grouping.mode !== "date") n++;
  if (ctx.grouping.status !== "all") n++;
  if (ctx.grouping.linkageId !== "all") n++;
  return n;
}
