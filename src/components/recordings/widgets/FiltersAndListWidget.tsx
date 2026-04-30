import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RecordingFilters } from "@/components/recordings/RecordingFilters";
import { RecordingCard } from "@/components/recordings/RecordingCard";
import { useRecordingsPageCtx } from "./context";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { useRecordingLists } from "@/lib/hooks/useRecordingLists";
import type { Recording, RecordingStatus, RecordingSource } from "@/lib/types/domain";

// ── Stats types & helpers ───────────────────────────────────────────────────

type Dimension =
  | "status"
  | "source"
  | "project"
  | "task_list"
  | "event_calendar"
  | "recording_list";

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "status", label: "סטטוס" },
  { value: "source", label: "מקור" },
  { value: "project", label: "פרויקט" },
  { value: "task_list", label: "רשימה" },
  { value: "event_calendar", label: "יומן" },
  { value: "recording_list", label: "רשימת הקלטות" },
];

const STATUS_LABEL: Record<RecordingStatus, string> = {
  recording: "מקליטה",
  uploaded: "הועלתה",
  transcribing: "מתמללת",
  extracting: "מחלצת",
  processing: "מעבדת",
  processed: "עובדה",
  ready: "מוכנה",
  error: "שגיאה",
};

const SOURCE_LABEL: Record<RecordingSource, string> = {
  thought: "מחשבה",
  call: "שיחה",
  meeting: "פגישה",
  recording: "מהקלטה",
  whatsapp: "מוואטספ",
  upload: "מהעלאה",
  other: "אחר",
};

interface NamedRow {
  id: string;
  name: string;
  emoji?: string | null;
}
function byId(rows: NamedRow[]) {
  const map = new Map(rows.map((r) => [r.id, r.name]));
  return (id: string) => map.get(id) ?? "—";
}
function byEmojiId(rows: NamedRow[]) {
  const map = new Map(
    rows.map((r) => [r.id, `${visibleEmoji(r.emoji)}${r.name}`] as const),
  );
  return (id: string) => map.get(id) ?? "—";
}
function visibleEmoji(emoji: string | null | undefined): string {
  if (!emoji) return "";
  if (emoji.startsWith("icon:")) return "";
  return emoji + " ";
}

interface Bucket { key: string; label: string; count: number }

function bucketize({
  rows, dim, listsByRecording, nameLookup,
}: {
  rows: Recording[];
  dim: Dimension;
  listsByRecording: Map<string, Set<string>>;
  nameLookup: {
    project: (id: string) => string;
    task_list: (id: string) => string;
    event_calendar: (id: string) => string;
    recording_list: (id: string) => string;
  };
}): Bucket[] {
  const counts = new Map<string, number>();
  const NONE = "__none__";
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const r of rows) {
    switch (dim) {
      case "status": bump(r.status); break;
      case "source": bump(r.source); break;
      case "project": bump(r.project_id ?? NONE); break;
      case "task_list": bump(r.task_list_id ?? NONE); break;
      case "event_calendar": bump(r.event_calendar_id ?? NONE); break;
      case "recording_list": {
        const lists = listsByRecording.get(r.id);
        if (!lists || lists.size === 0) bump(NONE);
        else for (const id of lists) bump(id);
        break;
      }
    }
  }
  const buckets: Bucket[] = [];
  for (const [key, count] of counts) {
    let label: string;
    if (key === NONE) {
      label = "ללא שיוך";
    } else {
      switch (dim) {
        case "status": label = STATUS_LABEL[key as RecordingStatus] ?? key; break;
        case "source": label = SOURCE_LABEL[key as RecordingSource] ?? key; break;
        case "project": label = nameLookup.project(key); break;
        case "task_list": label = nameLookup.task_list(key); break;
        case "event_calendar": label = nameLookup.event_calendar(key); break;
        case "recording_list": label = nameLookup.recording_list(key); break;
        default: label = key;
      }
    }
    buckets.push({ key, label, count });
  }
  return buckets.sort((a, b) => b.count - a.count);
}

// ── Main widget ─────────────────────────────────────────────────────────────

/**
 * Right-side panel: stats (collapsed by default) → filters (collapsed by
 * default) → recordings list. Each collapsible section pushes the list
 * down when expanded, exactly like the filter banner does to the list.
 */
export function FiltersAndListWidget() {
  const ctx = useRecordingsPageCtx();

  // Stats state
  const [statsOpen, setStatsOpen] = useState(false);
  const [dim, setDim] = useState<Dimension>("status");
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const { data: calendars = [] } = useEventCalendars();
  const { data: recordingLists = [] } = useRecordingLists();

  const buckets = useMemo(
    () =>
      bucketize({
        rows: ctx.allRecordings,
        dim,
        listsByRecording: ctx.listsByRecording,
        nameLookup: {
          project: byId(projects),
          task_list: byEmojiId(taskLists),
          event_calendar: byEmojiId(calendars),
          recording_list: byEmojiId(recordingLists),
        },
      }),
    [ctx.allRecordings, ctx.listsByRecording, dim, projects, taskLists, calendars, recordingLists],
  );
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;

  // Filters state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const recordings = ctx.filteredRecordings;
  const total = ctx.allRecordings.length;
  const hidden = total - recordings.length;

  return (
    <div className="card h-full flex flex-col overflow-hidden">

      {/* ── Stats section ── */}
      <button
        type="button"
        onClick={() => setStatsOpen((v) => !v)}
        aria-expanded={statsOpen}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2 border-b border-ink-200",
          "text-sm text-ink-700 hover:bg-ink-50 transition-colors",
        )}
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <BarChart3 className="w-3.5 h-3.5" />
          סטטיסטיקה
        </span>
        {statsOpen ? (
          <ChevronUp className="w-4 h-4 text-ink-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-ink-500" />
        )}
      </button>

      {statsOpen && (
        <div className="border-b border-ink-200">
          <div className="px-2 pt-2">
            <select
              value={dim}
              onChange={(e) => setDim(e.target.value as Dimension)}
              className="field !py-1 !px-2 !text-[11px] w-full"
              aria-label="ממד פילוח"
            >
              {DIMENSIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="px-2 py-2 max-h-48 overflow-auto scrollbar-thin">
            {buckets.length === 0 ? (
              <p className="text-[11px] text-ink-500 text-center py-3">אין נתונים</p>
            ) : (
              <ul className="space-y-1.5">
                {buckets.map((b) => (
                  <li key={b.key}>
                    <div className="flex items-center justify-between text-[11px] text-ink-700 mb-0.5">
                      <span className="truncate" title={b.label}>{b.label}</span>
                      <span className="text-ink-500 tabular-nums shrink-0 ms-1">{b.count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-gradient-to-r from-primary-400 to-primary-600"
                        style={{ width: `${(b.count / max) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-3 pb-2 text-[10px] text-ink-500 text-center">
            {ctx.allRecordings.length} הקלטות סה״כ
          </div>
        </div>
      )}

      {/* ── Filters section ── */}
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

      {/* ── Recordings list ── */}
      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1.5 scrollbar-thin">
        {ctx.isLoading ? (
          <p className="p-4 text-center text-xs text-ink-500">טוענת…</p>
        ) : total === 0 ? (
          <p className="p-4 text-center text-xs text-ink-500">
            עוד אין הקלטות. גררי קובץ או הקליטי ישירות.
          </p>
        ) : recordings.length === 0 ? (
          <FilteredEmpty total={total} hidden={hidden} onClear={ctx.clearAll} />
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
