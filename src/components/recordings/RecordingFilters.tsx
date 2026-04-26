import { Activity, Calendar, Filter, Link2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { useRecordingLists } from "@/lib/hooks/useRecordingLists";
import {
  type ListGroupingState,
  type GroupMode,
  type LinkageType,
  DEFAULT_GROUPING,
} from "@/components/recordings/RecordingsListBanner";
import type { RecordingStatus } from "@/lib/types/domain";

export type RecordingsFilterState = {
  search: string;
  includeArchived: boolean;
};

export const DEFAULT_RECORDING_FILTERS: RecordingsFilterState = {
  search: "",
  includeArchived: false,
};

interface Props {
  filters: RecordingsFilterState;
  onFiltersChange: (next: RecordingsFilterState) => void;
  grouping: ListGroupingState;
  onGroupingChange: (next: ListGroupingState) => void;
  className?: string;
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

export function RecordingFilters({
  filters,
  onFiltersChange,
  grouping,
  onGroupingChange,
  className,
}: Props) {
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const { data: calendars = [] } = useEventCalendars();
  const { data: recordingLists = [] } = useRecordingLists();

  const setMode = (m: GroupMode) => onGroupingChange({ ...grouping, mode: m });

  const linkageOptions = (() => {
    switch (grouping.linkageType) {
      case "project":
        return projects.map((p) => ({ value: p.id, label: p.name }));
      case "task_list":
        return taskLists.map((l) => ({
          value: l.id,
          label: `${visibleEmojiPrefix(l.emoji)}${l.name}`,
        }));
      case "event_calendar":
        return calendars.map((c) => ({
          value: c.id,
          label: `${visibleEmojiPrefix(c.emoji)}${c.name}`,
        }));
      case "recording_list":
        return recordingLists.map((l) => ({
          value: l.id,
          label: `${visibleEmojiPrefix(l.emoji)}${l.name}`,
        }));
    }
  })();

  const hasAny =
    filters.search.trim() !== "" ||
    filters.includeArchived ||
    grouping.mode !== DEFAULT_GROUPING.mode ||
    grouping.status !== DEFAULT_GROUPING.status ||
    grouping.dateOrder !== DEFAULT_GROUPING.dateOrder ||
    grouping.linkageType !== DEFAULT_GROUPING.linkageType ||
    grouping.linkageId !== DEFAULT_GROUPING.linkageId;

  const clearAll = () => {
    onFiltersChange(DEFAULT_RECORDING_FILTERS);
    onGroupingChange(DEFAULT_GROUPING);
  };

  return (
    <div className={cn("card p-4 space-y-3", className)}>
      <header className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
          <Filter className="w-4 h-4" />
          סינון והגדרות
        </div>
        {hasAny && (
          <button
            onClick={clearAll}
            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
            title="נקי סינון וקיבוץ"
          >
            <X className="w-3 h-3" />
            נקי
          </button>
        )}
      </header>

      {/* Search — always visible */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-ink-400 absolute end-2 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          placeholder="חיפוש לפי כותרת..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="field !py-1.5 !text-xs pe-7"
        />
      </div>

      {/* Grouping tabs + sub-pickers — moved here from a separate banner.
          flex-nowrap so the row keeps a single line and forces the
          enclosing card to grow leftward when linkage mode adds two
          selects, instead of wrapping internally. */}
      <div className="flex flex-nowrap items-center gap-2">
        <div className="inline-flex rounded-md bg-ink-100 p-0.5">
          <ModeTab
            icon={Activity}
            label="לפי סטטוס"
            active={grouping.mode === "status"}
            onClick={() => setMode("status")}
          />
          <ModeTab
            icon={Calendar}
            label="לפי תאריך"
            active={grouping.mode === "date"}
            onClick={() => setMode("date")}
          />
          <ModeTab
            icon={Link2}
            label="לפי שיוך"
            active={grouping.mode === "linkage"}
            onClick={() => setMode("linkage")}
          />
        </div>

        {grouping.mode === "status" && (
          <select
            value={grouping.status}
            onChange={(e) =>
              onGroupingChange({
                ...grouping,
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

        {grouping.mode === "date" && (
          <div className="inline-flex rounded-md bg-ink-100 p-0.5">
            <ModeTab
              label="חדשות → ישנות"
              active={grouping.dateOrder === "desc"}
              onClick={() => onGroupingChange({ ...grouping, dateOrder: "desc" })}
            />
            <ModeTab
              label="ישנות → חדשות"
              active={grouping.dateOrder === "asc"}
              onClick={() => onGroupingChange({ ...grouping, dateOrder: "asc" })}
            />
          </div>
        )}

        {grouping.mode === "linkage" && (
          <>
            <select
              value={grouping.linkageType}
              onChange={(e) =>
                onGroupingChange({
                  ...grouping,
                  linkageType: e.target.value as LinkageType,
                  linkageId: "all",
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
              value={grouping.linkageId}
              onChange={(e) =>
                onGroupingChange({
                  ...grouping,
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

      {/* Archived toggle */}
      <label className="flex items-center justify-between gap-2 cursor-pointer text-xs text-ink-700">
        <span>כלולות בארכיון</span>
        <input
          type="checkbox"
          checked={filters.includeArchived}
          onChange={(e) =>
            onFiltersChange({ ...filters, includeArchived: e.target.checked })
          }
          className="accent-primary-500"
        />
      </label>
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
 * Apply the simplified filter state on the rows: search + archived only.
 * Grouping (status / date / linkage) is applied separately by `applyGrouping`.
 */
export function filterRecordings<T extends {
  title: string | null;
  audio_archived: boolean;
}>(rows: T[], filters: RecordingsFilterState): T[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (!filters.includeArchived && r.audio_archived) return false;
    if (q && !(r.title ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * `task_lists.emoji` (and the matching column on event_calendars /
 * recording_lists) stores either a real emoji character or an internal token
 * like "icon:work" pointing at a Lucide preset. Plain HTML `<option>` can't
 * render a Lucide component, so we hide the token and just render the name.
 */
function visibleEmojiPrefix(emoji: string | null | undefined): string {
  if (!emoji) return "";
  if (emoji.startsWith("icon:")) return "";
  return emoji + " ";
}
