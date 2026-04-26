import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { useRecordingLists } from "@/lib/hooks/useRecordingLists";
import type { RecordingSource } from "@/lib/types/domain";

export type RecordingsSort =
  | "created_desc"
  | "created_asc"
  | "duration_desc"
  | "duration_asc";

export type RecordingsFilterState = {
  search: string;
  source: RecordingSource | "all";
  projectId: string | "all" | "none";
  taskListId: string | "all" | "none";
  eventCalendarId: string | "all" | "none";
  recordingListId: string | "all" | "none";
  includeArchived: boolean;
  sort: RecordingsSort;
};

export const DEFAULT_RECORDING_FILTERS: RecordingsFilterState = {
  search: "",
  source: "all",
  projectId: "all",
  taskListId: "all",
  eventCalendarId: "all",
  recordingListId: "all",
  includeArchived: false,
  sort: "created_desc",
};

interface Props {
  value: RecordingsFilterState;
  onChange: (next: RecordingsFilterState) => void;
  className?: string;
}

const SOURCES: { value: RecordingsFilterState["source"]; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "thought", label: "מחשבות" },
  { value: "call", label: "שיחות" },
  { value: "meeting", label: "פגישות" },
  { value: "other", label: "אחר" },
];

const SORTS: { value: RecordingsSort; label: string }[] = [
  { value: "created_desc", label: "חדשות → ישנות" },
  { value: "created_asc", label: "ישנות → חדשות" },
  { value: "duration_desc", label: "ארוכות תחילה" },
  { value: "duration_asc", label: "קצרות תחילה" },
];

export function RecordingFilters({ value, onChange, className }: Props) {
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const { data: calendars = [] } = useEventCalendars();
  const { data: recordingLists = [] } = useRecordingLists();

  const set = <K extends keyof RecordingsFilterState>(
    key: K,
    v: RecordingsFilterState[K]
  ) => onChange({ ...value, [key]: v });

  const hasAny =
    value.search.trim() !== "" ||
    value.source !== "all" ||
    value.projectId !== "all" ||
    value.taskListId !== "all" ||
    value.eventCalendarId !== "all" ||
    value.recordingListId !== "all" ||
    value.includeArchived ||
    value.sort !== "created_desc";

  return (
    <div className={cn("card p-4 space-y-3", className)}>
      <header className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
          <Filter className="w-4 h-4" />
          סינון והגדרות
        </div>
        {hasAny && (
          <button
            onClick={() => onChange(DEFAULT_RECORDING_FILTERS)}
            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
            title="נקה סינון"
          >
            <X className="w-3 h-3" />
            נקי
          </button>
        )}
      </header>

      {/* Search */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-ink-400">חיפוש</span>
        <div className="relative mt-1">
          <Search className="w-3.5 h-3.5 text-ink-400 absolute end-2 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="כותרת..."
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            className="field !py-1.5 !text-xs pe-7"
          />
        </div>
      </label>

      {/* Source */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-ink-400">מקור</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => set("source", s.value)}
              className={cn(
                "px-2 py-1 rounded-xs text-xs transition-colors",
                value.source === s.value
                  ? "bg-ink-900 text-white"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project */}
      <SelectFilter
        label="פרויקט"
        value={value.projectId}
        onChange={(v) => set("projectId", v as RecordingsFilterState["projectId"])}
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
      />

      {/* Task list */}
      <SelectFilter
        label="רשימת משימות"
        value={value.taskListId}
        onChange={(v) => set("taskListId", v as RecordingsFilterState["taskListId"])}
        options={taskLists.map((l) => ({
          value: l.id,
          label: `${l.emoji ? `${l.emoji} ` : ""}${l.name}`,
        }))}
      />

      {/* Event calendar */}
      <SelectFilter
        label="יומן אירועים"
        value={value.eventCalendarId}
        onChange={(v) => set("eventCalendarId", v as RecordingsFilterState["eventCalendarId"])}
        options={calendars.map((c) => ({
          value: c.id,
          label: `${c.emoji ? `${c.emoji} ` : ""}${c.name}`,
        }))}
      />

      {/* Recording list */}
      <SelectFilter
        label="רשימת הקלטות"
        value={value.recordingListId}
        onChange={(v) => set("recordingListId", v as RecordingsFilterState["recordingListId"])}
        options={recordingLists.map((l) => ({
          value: l.id,
          label: `${l.emoji ? `${l.emoji} ` : ""}${l.name}`,
        }))}
      />

      {/* Sort */}
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-ink-400">מיון</span>
        <select
          value={value.sort}
          onChange={(e) => set("sort", e.target.value as RecordingsSort)}
          className="field !py-1.5 !text-xs mt-1"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {/* Archived toggle */}
      <label className="flex items-center justify-between gap-2 cursor-pointer text-xs text-ink-700">
        <span>כלולות בארכיון</span>
        <input
          type="checkbox"
          checked={value.includeArchived}
          onChange={(e) => set("includeArchived", e.target.checked)}
          className="accent-primary-500"
        />
      </label>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-ink-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field !py-1.5 !text-xs mt-1"
      >
        <option value="all">הכל</option>
        <option value="none">ללא שיוך</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Apply the filter state on the client. `listAssignments` lets us filter by
 * recording_list_id, which is many-to-many and isn't a column on `recordings`.
 */
export function filterRecordings<T extends {
  id: string;
  title: string | null;
  source: RecordingSource;
  project_id: string | null;
  task_list_id: string | null;
  event_calendar_id: string | null;
  audio_archived: boolean;
  created_at: string;
  duration_seconds: number | null;
}>(
  rows: T[],
  filters: RecordingsFilterState,
  listAssignmentsByRecording?: Map<string, Set<string>>
): T[] {
  const q = filters.search.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (!filters.includeArchived && r.audio_archived) return false;
    if (filters.source !== "all" && r.source !== filters.source) return false;

    if (!matchesSingleId(filters.projectId, r.project_id)) return false;
    if (!matchesSingleId(filters.taskListId, r.task_list_id)) return false;
    if (!matchesSingleId(filters.eventCalendarId, r.event_calendar_id)) return false;

    if (filters.recordingListId !== "all") {
      const lists = listAssignmentsByRecording?.get(r.id);
      if (filters.recordingListId === "none") {
        if (lists && lists.size > 0) return false;
      } else if (!lists || !lists.has(filters.recordingListId)) {
        return false;
      }
    }

    if (q && !(r.title ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
  out = [...out].sort((a, b) => {
    switch (filters.sort) {
      case "created_asc":
        return a.created_at.localeCompare(b.created_at);
      case "duration_desc":
        return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
      case "duration_asc":
        return (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0);
      case "created_desc":
      default:
        return b.created_at.localeCompare(a.created_at);
    }
  });
  return out;
}

function matchesSingleId(filter: string, value: string | null): boolean {
  if (filter === "all") return true;
  if (filter === "none") return !value;
  return value === filter;
}
