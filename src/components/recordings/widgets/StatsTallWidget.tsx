import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { useRecordingLists } from "@/lib/hooks/useRecordingLists";
import type {
  Recording,
  RecordingStatus,
  RecordingSource,
} from "@/lib/types/domain";
import { useRecordingsPageCtx } from "./context";

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
  other: "העלאה",
};

/**
 * Tall narrow stats widget. Header is clickable — clicking collapses the
 * body inline (same UX as the filters banner). Mirrors that pattern so
 * minimizing doesn't leave a blank white card behind.
 */
export function StatsTallWidget() {
  const ctx = useRecordingsPageCtx();
  // Default open so the bars are visible on first paint. Persisted to
  // localStorage so the user's choice sticks.
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem("multitask.recordings.statsOpen");
    return raw === null ? true : raw === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.recordings.statsOpen", String(open));
  }, [open]);
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
    [
      ctx.allRecordings,
      ctx.listsByRecording,
      dim,
      projects,
      taskLists,
      calendars,
      recordingLists,
    ],
  );

  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2",
          "text-sm text-ink-700 hover:bg-ink-50 transition-colors",
          open && "border-b border-ink-200",
        )}
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <BarChart3 className="w-3.5 h-3.5 text-ink-600" />
          סטטיסטיקה
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-ink-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-ink-500" />
        )}
      </button>

      {open && (
        <>
          <div className="px-2 py-2 border-b border-ink-200">
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

          <div className="flex-1 min-h-0 overflow-auto px-2 py-2 scrollbar-thin">
            {buckets.length === 0 ? (
              <p className="text-[11px] text-ink-500 text-center py-4">
                אין נתונים
              </p>
            ) : (
              <ul className="space-y-1.5">
                {buckets.map((b) => (
                  <li key={b.key}>
                    <div className="flex items-center justify-between text-[11px] text-ink-700 mb-0.5">
                      <span className="truncate" title={b.label}>
                        {b.label}
                      </span>
                      <span className="text-ink-500 tabular-nums shrink-0 ms-1">
                        {b.count}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          "bg-gradient-to-r from-primary-400 to-primary-600",
                        )}
                        style={{ width: `${(b.count / max) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="px-3 py-1.5 border-t border-ink-200 text-[10px] text-ink-500 text-center">
            {ctx.allRecordings.length} הקלטות סה״כ
          </footer>
        </>
      )}
    </div>
  );
}

interface NamedRow {
  id: string;
  name: string;
  emoji?: string | null;
}

function byId(rows: NamedRow[]): (id: string) => string {
  const map = new Map(rows.map((r) => [r.id, r.name]));
  return (id) => map.get(id) ?? "—";
}

function byEmojiId(rows: NamedRow[]): (id: string) => string {
  const map = new Map(
    rows.map((r) => [r.id, `${visibleEmoji(r.emoji)}${r.name}`] as const),
  );
  return (id) => map.get(id) ?? "—";
}

function visibleEmoji(emoji: string | null | undefined): string {
  if (!emoji) return "";
  if (emoji.startsWith("icon:")) return "";
  return emoji + " ";
}

interface Bucket {
  key: string;
  label: string;
  count: number;
}

function bucketize({
  rows,
  dim,
  listsByRecording,
  nameLookup,
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
  const NONE_KEY = "__none__";

  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);

  for (const r of rows) {
    switch (dim) {
      case "status":
        bump(r.status);
        break;
      case "source":
        bump(r.source);
        break;
      case "project":
        bump(r.project_id ?? NONE_KEY);
        break;
      case "task_list":
        bump(r.task_list_id ?? NONE_KEY);
        break;
      case "event_calendar":
        bump(r.event_calendar_id ?? NONE_KEY);
        break;
      case "recording_list": {
        const lists = listsByRecording.get(r.id);
        if (!lists || lists.size === 0) {
          bump(NONE_KEY);
        } else {
          for (const id of lists) bump(id);
        }
        break;
      }
    }
  }

  const buckets: Bucket[] = [];
  for (const [key, count] of counts) {
    buckets.push({ key, label: labelFor(dim, key, NONE_KEY, nameLookup), count });
  }
  return buckets.sort((a, b) => b.count - a.count);
}

function labelFor(
  dim: Dimension,
  key: string,
  noneKey: string,
  nameLookup: {
    project: (id: string) => string;
    task_list: (id: string) => string;
    event_calendar: (id: string) => string;
    recording_list: (id: string) => string;
  },
): string {
  if (key === noneKey) return "ללא שיוך";
  switch (dim) {
    case "status":
      return STATUS_LABEL[key as RecordingStatus] ?? key;
    case "source":
      return SOURCE_LABEL[key as RecordingSource] ?? key;
    case "project":
      return nameLookup.project(key);
    case "task_list":
      return nameLookup.task_list(key);
    case "event_calendar":
      return nameLookup.event_calendar(key);
    case "recording_list":
      return nameLookup.recording_list(key);
  }
}
