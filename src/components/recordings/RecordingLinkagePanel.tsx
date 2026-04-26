import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FolderKanban,
  ListChecks,
  CalendarDays,
  Mic,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
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
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

/**
 * Editable chip-bar with all four linkage types always visible. Each pill
 * shows the assigned value (and a primary tint when set) and opens a
 * dropdown picker on click. The recording-lists pill is multi-select with
 * an inline create-new-list form.
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

  const setSingle = (
    field: "project_id" | "task_list_id" | "event_calendar_id",
    value: string | null
  ) => {
    updateRecording.mutate({
      recordingId: recording.id,
      patch: { [field]: value },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <SingleLinkPill
        icon={FolderKanban}
        label="פרויקט"
        current={project ? project.name : null}
        options={projects.map((p) => ({ id: p.id, label: p.name }))}
        onChange={(id) => setSingle("project_id", id)}
      />
      <SingleLinkPill
        icon={ListChecks}
        label="משימות"
        current={taskList ? taskList.name : null}
        valueIcon={
          taskList ? (
            <ListIcon emoji={taskList.emoji} className="w-3.5 h-3.5" />
          ) : null
        }
        options={taskLists.map((l) => ({
          id: l.id,
          label: l.name,
          icon: <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />,
        }))}
        onChange={(id) => setSingle("task_list_id", id)}
      />
      <SingleLinkPill
        icon={CalendarDays}
        label="יומן"
        current={calendar ? calendar.name : null}
        valueIcon={
          calendar ? (
            <ListIcon emoji={calendar.emoji} className="w-3.5 h-3.5" />
          ) : null
        }
        options={calendars.map((c) => ({
          id: c.id,
          label: c.name,
          icon: <ListIcon emoji={c.emoji} className="w-3.5 h-3.5" />,
        }))}
        onChange={(id) => setSingle("event_calendar_id", id)}
      />
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
    </div>
  );
}

// =============================================================================
// Single linkage pill — chip + dropdown to pick one option (or clear)
// =============================================================================

function SingleLinkPill({
  icon: Icon,
  label,
  current,
  valueIcon,
  options,
  onChange,
}: {
  icon: typeof FolderKanban;
  label: string;
  current: string | null;
  /** Optional icon shown alongside the current value text (e.g. ListIcon). */
  valueIcon?: ReactNode;
  options: { id: string; label: string; icon?: ReactNode }[];
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
        {valueIcon}
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
                  "inline-flex items-center gap-1",
                  current === o.label && "bg-primary-50 text-primary-800"
                )}
              >
                {o.icon}
                <span className="truncate">{o.label}</span>
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
      ? myLists[0].name
      : `${myLists.length} רשימות`;
  const summaryIcon =
    myLists.length === 1 ? (
      <ListIcon emoji={myLists[0].emoji} className="w-3.5 h-3.5" />
    ) : null;

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
        {summaryIcon}
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
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <ListIcon emoji={l.emoji} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{l.name}</span>
                  </span>
                  <button
                    onClick={() => onUnassign(l.id)}
                    className="hover:text-danger-700 shrink-0"
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
                  className="w-full text-start px-2 py-1 text-xs rounded hover:bg-ink-100 inline-flex items-center gap-1"
                >
                  <ListIcon emoji={l.emoji} className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{l.name}</span>
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
