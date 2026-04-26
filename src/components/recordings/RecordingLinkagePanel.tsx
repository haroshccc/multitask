import { useEffect, useRef, useState } from "react";
import {
  FolderKanban,
  ListChecks,
  CalendarDays,
  Mic,
  Plus,
  X,
  ChevronDown,
  Activity,
  Phone,
  Users,
  FileAudio,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUpdateRecording } from "@/lib/hooks/useRecordings";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import {
  useRecordingLists,
  useRecordingListAssignments,
  useAssignRecordingToList,
  useUnassignRecordingFromList,
  useCreateRecordingList,
} from "@/lib/hooks/useRecordingLists";
import type {
  Recording,
  RecordingSource,
  RecordingStatus,
} from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

/**
 * Single chip-bar that summarises the recording: status + source as
 * read-only display chips, then linkage chips (project / task list / event
 * calendar / recording lists) — but only for linkages the user has actually
 * assigned. A trailing "+ שייך" pill toggles the unassigned pills into view
 * so the user can add new linkages without permanently bloating the bar.
 */
export function RecordingLinkagePanel({ recording }: Props) {
  const updateRecording = useUpdateRecording();
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const { data: calendars = [] } = useEventCalendars();
  const { data: recordingLists = [] } = useRecordingLists();
  const { data: assignments = [] } = useRecordingListAssignments(recording.id);

  const assignList = useAssignRecordingToList();
  const unassignList = useUnassignRecordingFromList();
  const createList = useCreateRecordingList();

  const project = projects.find((p) => p.id === recording.project_id) ?? null;
  const taskList = taskLists.find((l) => l.id === recording.task_list_id) ?? null;
  const calendar = calendars.find((c) => c.id === recording.event_calendar_id) ?? null;
  const myLists = assignments
    .map((a) => recordingLists.find((l) => l.id === a.list_id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  // Edit mode reveals unassigned chips; default keeps the bar minimal.
  const [showAll, setShowAll] = useState(false);

  const setSingle = (
    field: "project_id" | "task_list_id" | "event_calendar_id",
    value: string | null
  ) => {
    updateRecording.mutate({
      recordingId: recording.id,
      patch: { [field]: value },
    });
  };

  // Each linkage chip has either a value (always show) or is empty (only
  // shown in edit mode). The recording-lists chip counts as "assigned" if
  // there's at least one assignment.
  const projectAssigned = !!project;
  const taskListAssigned = !!taskList;
  const calendarAssigned = !!calendar;
  const recordingListsAssigned = myLists.length > 0;
  const hasUnassigned =
    !projectAssigned ||
    !taskListAssigned ||
    !calendarAssigned ||
    !recordingListsAssigned;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* Status — read-only display */}
      <DisplayChip
        icon={Activity}
        label="סטטוס"
        value={statusLabel(recording.status)}
      />

      {/* Source — read-only display */}
      <DisplayChip
        icon={sourceIcon(recording.source)}
        label="מקור"
        value={sourceLabel(recording.source)}
      />

      {/* Project chip — always shown if assigned, only in edit mode otherwise */}
      {(projectAssigned || showAll) && (
        <SingleLinkPill
          icon={FolderKanban}
          label="פרויקט"
          current={project ? project.name : null}
          options={projects.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(id) => setSingle("project_id", id)}
        />
      )}

      {(taskListAssigned || showAll) && (
        <SingleLinkPill
          icon={ListChecks}
          label="משימות"
          current={
            taskList
              ? `${taskList.emoji ? taskList.emoji + " " : ""}${taskList.name}`
              : null
          }
          options={taskLists.map((l) => ({
            id: l.id,
            label: `${l.emoji ? l.emoji + " " : ""}${l.name}`,
          }))}
          onChange={(id) => setSingle("task_list_id", id)}
        />
      )}

      {(calendarAssigned || showAll) && (
        <SingleLinkPill
          icon={CalendarDays}
          label="יומן"
          current={
            calendar
              ? `${calendar.emoji ? calendar.emoji + " " : ""}${calendar.name}`
              : null
          }
          options={calendars.map((c) => ({
            id: c.id,
            label: `${c.emoji ? c.emoji + " " : ""}${c.name}`,
          }))}
          onChange={(id) => setSingle("event_calendar_id", id)}
        />
      )}

      {(recordingListsAssigned || showAll) && (
        <RecordingListsPill
          icon={Mic}
          myLists={myLists}
          availableLists={recordingLists.filter(
            (l) => !myLists.some((m) => m.id === l.id)
          )}
          onAssign={(listId) =>
            assignList.mutate({ recordingId: recording.id, listId })
          }
          onUnassign={(listId) =>
            unassignList.mutate({ recordingId: recording.id, listId })
          }
          onCreate={async (name) => {
            const list = await createList.mutateAsync({ name, sort_order: 0 });
            await assignList.mutateAsync({
              recordingId: recording.id,
              listId: list.id,
            });
          }}
        />
      )}

      {hasUnassigned && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 transition-colors",
            showAll
              ? "border-ink-400 text-ink-700 bg-ink-50"
              : "border-ink-300 text-ink-500 hover:bg-ink-50"
          )}
        >
          <Plus className="w-3 h-3" />
          {showAll ? "סיום" : "שייך"}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Read-only display chip (status / source)
// =============================================================================

function DisplayChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-ink-300 bg-white px-2 py-1 text-ink-700">
      <Icon className="w-3.5 h-3.5 text-ink-500" />
      <span className="font-medium">{label}:</span>
      <span className="truncate max-w-[120px]">{value}</span>
    </span>
  );
}

// =============================================================================
// Single linkage pill — small chip that opens a dropdown to pick one option
// =============================================================================

function SingleLinkPill({
  icon: Icon,
  label,
  current,
  options,
  onChange,
}: {
  icon: typeof FolderKanban;
  label: string;
  current: string | null;
  options: { id: string; label: string }[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors",
          current
            ? "border-primary-300 bg-primary-50 text-primary-800"
            : "border-ink-300 bg-white text-ink-600 hover:bg-ink-50"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">{label}:</span>
        <span className="truncate max-w-[120px]">{current ?? "—"}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 start-0 w-56 max-h-64 overflow-y-auto bg-white border border-ink-200 rounded-md shadow-lift p-1">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "w-full text-start px-2 py-1.5 text-xs rounded hover:bg-ink-100",
              !current && "bg-ink-100"
            )}
          >
            — ללא —
          </button>
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-[11px] text-ink-400">אין אפשרויות</div>
          ) : (
            options.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-start px-2 py-1.5 text-xs rounded hover:bg-ink-100 truncate",
                  current === o.label && "bg-primary-50 text-primary-800"
                )}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Recording-lists pill — multi-select with inline create
// =============================================================================

function RecordingListsPill({
  icon: Icon,
  myLists,
  availableLists,
  onAssign,
  onUnassign,
  onCreate,
}: {
  icon: typeof Mic;
  myLists: { id: string; name: string; emoji: string | null }[];
  availableLists: { id: string; name: string; emoji: string | null }[];
  onAssign: (listId: string) => void;
  onUnassign: (listId: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, () => setOpen(false));

  const summary =
    myLists.length === 0
      ? "—"
      : myLists.length === 1
      ? `${myLists[0].emoji ? myLists[0].emoji + " " : ""}${myLists[0].name}`
      : `${myLists.length} רשימות`;

  const handleCreate = async () => {
    const n = newName.trim();
    if (!n) return;
    setCreating(true);
    try {
      await onCreate(n);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors",
          myLists.length > 0
            ? "border-primary-300 bg-primary-50 text-primary-800"
            : "border-ink-300 bg-white text-ink-600 hover:bg-ink-50"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">רשימות:</span>
        <span className="truncate max-w-[120px]">{summary}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 start-0 w-64 max-h-80 overflow-y-auto bg-white border border-ink-200 rounded-md shadow-lift p-2 space-y-2">
          {myLists.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-ink-400">משויכות</div>
              {myLists.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-1 rounded bg-primary-50 px-2 py-1 text-xs text-primary-800"
                >
                  <span className="truncate">
                    {l.emoji ? l.emoji + " " : ""}
                    {l.name}
                  </span>
                  <button
                    onClick={() => onUnassign(l.id)}
                    className="hover:text-danger-700"
                    aria-label="הסר"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableLists.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-ink-400">הוסיפי לרשימה</div>
              {availableLists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onAssign(l.id)}
                  className="w-full text-start px-2 py-1 text-xs rounded hover:bg-ink-100 truncate"
                >
                  {l.emoji ? l.emoji + " " : ""}
                  {l.name}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="flex items-center gap-1 pt-1 border-t border-ink-200"
          >
            <input
              type="text"
              placeholder="רשימה חדשה…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
              disabled={creating}
            />
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="btn-ghost !py-1 !px-2 disabled:opacity-50"
              title="צרי וחברי"
            >
              <Plus className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function statusLabel(status: RecordingStatus): string {
  switch (status) {
    case "recording":
      return "מקליטה";
    case "uploaded":
      return "הועלתה";
    case "transcribing":
      return "מתמללת";
    case "extracting":
      return "מחלצת משימות";
    case "ready":
      return "מוכנה";
    case "error":
      return "שגיאה";
  }
}

function sourceLabel(source: RecordingSource): string {
  switch (source) {
    case "thought":
      return "מחשבה";
    case "call":
      return "שיחה";
    case "meeting":
      return "פגישה";
    default:
      return "אחר";
  }
}

function sourceIcon(source: RecordingSource) {
  switch (source) {
    case "thought":
      return Mic;
    case "call":
      return Phone;
    case "meeting":
      return Users;
    default:
      return FileAudio;
  }
}

function useClickAway(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, handler]);
}
