import { Activity, Calendar, Link2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { useRecordingLists } from "@/lib/hooks/useRecordingLists";
import type { RecordingStatus } from "@/lib/types/domain";

export type GroupMode = "status" | "date" | "linkage";
export type LinkageType =
  | "project"
  | "task_list"
  | "event_calendar"
  | "recording_list";
export type DateOrder = "asc" | "desc";

export type ListGroupingState = {
  mode: GroupMode;
  /** mode = "status" → which status to show ("all" = no narrowing) */
  status: RecordingStatus | "all";
  /** mode = "date" → ascending or descending */
  dateOrder: DateOrder;
  /** mode = "linkage" → which linkage type */
  linkageType: LinkageType;
  /** mode = "linkage" → which specific item under that type ("all" / "none" / id) */
  linkageId: string | "all" | "none";
};

export const DEFAULT_GROUPING: ListGroupingState = {
  mode: "date",
  status: "all",
  dateOrder: "desc",
  linkageType: "project",
  linkageId: "all",
};

interface Props {
  value: ListGroupingState;
  onChange: (next: ListGroupingState) => void;
}

const STATUSES: { value: RecordingStatus | "all"; label: string }[] = [
  { value: "all", label: "כל הסטטוסים" },
  { value: "recording", label: "מקליטה" },
  { value: "uploaded", label: "הועלתה" },
  { value: "transcribing", label: "מתמללת" },
  { value: "extracting", label: "מחלצת" },
  { value: "ready", label: "מוכנה" },
  { value: "error", label: "שגיאה" },
];

const LINKAGE_TYPES: { value: LinkageType; label: string }[] = [
  { value: "project", label: "פרויקט" },
  { value: "task_list", label: "רשימת משימות" },
  { value: "event_calendar", label: "יומן אירועים" },
  { value: "recording_list", label: "רשימת הקלטות" },
];

export function RecordingsListBanner({ value, onChange }: Props) {
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const { data: calendars = [] } = useEventCalendars();
  const { data: recordingLists = [] } = useRecordingLists();

  const setMode = (m: GroupMode) => onChange({ ...value, mode: m });

  const linkageOptions = (() => {
    switch (value.linkageType) {
      case "project":
        return projects.map((p) => ({ value: p.id, label: p.name }));
      case "task_list":
        return taskLists.map((l) => ({
          value: l.id,
          label: `${l.emoji ? l.emoji + " " : ""}${l.name}`,
        }));
      case "event_calendar":
        return calendars.map((c) => ({
          value: c.id,
          label: `${c.emoji ? c.emoji + " " : ""}${c.name}`,
        }));
      case "recording_list":
        return recordingLists.map((l) => ({
          value: l.id,
          label: `${l.emoji ? l.emoji + " " : ""}${l.name}`,
        }));
    }
  })();

  return (
    <div className="card p-3 flex flex-wrap items-center gap-2">
      {/* Mode tabs */}
      <div className="inline-flex rounded-md bg-ink-100 p-0.5">
        <ModeTab
          icon={Activity}
          label="לפי סטטוס"
          active={value.mode === "status"}
          onClick={() => setMode("status")}
        />
        <ModeTab
          icon={Calendar}
          label="לפי תאריך"
          active={value.mode === "date"}
          onClick={() => setMode("date")}
        />
        <ModeTab
          icon={Link2}
          label="לפי שיוך"
          active={value.mode === "linkage"}
          onClick={() => setMode("linkage")}
        />
      </div>

      <span className="text-ink-300">|</span>

      {/* Mode-specific sub-pickers */}
      {value.mode === "status" && (
        <select
          value={value.status}
          onChange={(e) =>
            onChange({
              ...value,
              status: e.target.value as ListGroupingState["status"],
            })
          }
          className="field !py-1.5 !text-xs !w-auto"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {value.mode === "date" && (
        <div className="inline-flex rounded-md bg-ink-100 p-0.5">
          <ModeTab
            label="חדשות → ישנות"
            active={value.dateOrder === "desc"}
            onClick={() => onChange({ ...value, dateOrder: "desc" })}
          />
          <ModeTab
            label="ישנות → חדשות"
            active={value.dateOrder === "asc"}
            onClick={() => onChange({ ...value, dateOrder: "asc" })}
          />
        </div>
      )}

      {value.mode === "linkage" && (
        <>
          <select
            value={value.linkageType}
            onChange={(e) =>
              onChange({
                ...value,
                linkageType: e.target.value as LinkageType,
                linkageId: "all", // reset specific selection on type change
              })
            }
            className="field !py-1.5 !text-xs !w-auto"
          >
            {LINKAGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={value.linkageId}
            onChange={(e) =>
              onChange({
                ...value,
                linkageId: e.target
                  .value as ListGroupingState["linkageId"],
              })
            }
            className="field !py-1.5 !text-xs !w-auto"
          >
            <option value="all">הכל</option>
            <option value="none">ללא שיוך</option>
            {linkageOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function ModeTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon?: typeof Activity;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-white text-ink-900 shadow-soft font-medium"
          : "text-ink-600 hover:text-ink-900"
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

/**
 * Apply the grouping state on the recording rows. Combines naturally with
 * the global RecordingFilters (search/source/etc) — call this after the
 * filter pass.
 */
export function applyGrouping<T extends {
  id: string;
  status: RecordingStatus;
  created_at: string;
  project_id: string | null;
  task_list_id: string | null;
  event_calendar_id: string | null;
}>(
  rows: T[],
  state: ListGroupingState,
  listAssignmentsByRecording?: Map<string, Set<string>>
): T[] {
  let out = rows;

  if (state.mode === "status" && state.status !== "all") {
    out = out.filter((r) => r.status === state.status);
  }

  if (state.mode === "linkage" && state.linkageId !== "all") {
    out = out.filter((r) => {
      switch (state.linkageType) {
        case "project":
          return matches(state.linkageId, r.project_id);
        case "task_list":
          return matches(state.linkageId, r.task_list_id);
        case "event_calendar":
          return matches(state.linkageId, r.event_calendar_id);
        case "recording_list": {
          const lists = listAssignmentsByRecording?.get(r.id);
          if (state.linkageId === "none") return !lists || lists.size === 0;
          return Boolean(lists && lists.has(state.linkageId));
        }
      }
    });
  }

  // Sorting: date mode picks the order; other modes default to newest-first.
  out = [...out].sort((a, b) => {
    if (state.mode === "date" && state.dateOrder === "asc") {
      return a.created_at.localeCompare(b.created_at);
    }
    return b.created_at.localeCompare(a.created_at);
  });
  return out;
}

function matches(filter: string, value: string | null): boolean {
  if (filter === "none") return !value;
  return value === filter;
}
