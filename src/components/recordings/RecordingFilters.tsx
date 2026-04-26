import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
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
  includeArchived: boolean;
  sort: RecordingsSort;
};

export const DEFAULT_RECORDING_FILTERS: RecordingsFilterState = {
  search: "",
  source: "all",
  projectId: "all",
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

  const set = <K extends keyof RecordingsFilterState>(
    key: K,
    v: RecordingsFilterState[K]
  ) => onChange({ ...value, [key]: v });

  const hasAny =
    value.search.trim() !== "" ||
    value.source !== "all" ||
    value.projectId !== "all" ||
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
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-ink-400">פרויקט</span>
        <select
          value={value.projectId}
          onChange={(e) => set("projectId", e.target.value as RecordingsFilterState["projectId"])}
          className="field !py-1.5 !text-xs mt-1"
        >
          <option value="all">הכל</option>
          <option value="none">ללא שיוך</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

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

/** Apply the filter state on the client. Hooks fetch the unfiltered set + we slice here. */
export function filterRecordings<T extends {
  title: string | null;
  source: RecordingSource;
  project_id: string | null;
  audio_archived: boolean;
  created_at: string;
  duration_seconds: number | null;
}>(rows: T[], filters: RecordingsFilterState): T[] {
  const q = filters.search.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (!filters.includeArchived && r.audio_archived) return false;
    if (filters.source !== "all" && r.source !== filters.source) return false;
    if (filters.projectId === "none" && r.project_id) return false;
    if (
      filters.projectId !== "all" &&
      filters.projectId !== "none" &&
      r.project_id !== filters.projectId
    )
      return false;
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
