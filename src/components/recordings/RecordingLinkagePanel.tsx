import { useState } from "react";
import { FolderKanban, ListChecks, CalendarDays, Mic, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useUpdateRecording,
} from "@/lib/hooks/useRecordings";
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
 * Linkage controls inside the player. Lets the user attach a recording to:
 *   - one project              (recordings.project_id)
 *   - one task list            (recordings.task_list_id)
 *   - one event calendar       (recordings.event_calendar_id)
 *   - many recording lists     (recording_list_assignments)
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

  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  const setSingleField = (
    field: "project_id" | "task_list_id" | "event_calendar_id",
    value: string | null
  ) => {
    updateRecording.mutate({
      recordingId: recording.id,
      patch: { [field]: value },
    });
  };

  const assignedIds = new Set(assignments.map((a) => a.list_id));
  const availableLists = recordingLists.filter((l) => !assignedIds.has(l.id));

  const handleCreateAndAssign = async () => {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const list = await createList.mutateAsync({ name, sort_order: 0 });
      await assignList.mutateAsync({ recordingId: recording.id, listId: list.id });
      setNewListName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2.5 text-xs">
      <Row icon={FolderKanban} label="פרויקט">
        <select
          className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
          value={recording.project_id ?? ""}
          onChange={(e) => setSingleField("project_id", e.target.value || null)}
        >
          <option value="">— ללא —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Row>

      <Row icon={ListChecks} label="רשימת משימות">
        <select
          className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
          value={recording.task_list_id ?? ""}
          onChange={(e) => setSingleField("task_list_id", e.target.value || null)}
        >
          <option value="">— ללא —</option>
          {taskLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.emoji ? `${l.emoji} ` : ""}
              {l.name}
            </option>
          ))}
        </select>
      </Row>

      <Row icon={CalendarDays} label="יומן אירועים">
        <select
          className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
          value={recording.event_calendar_id ?? ""}
          onChange={(e) => setSingleField("event_calendar_id", e.target.value || null)}
        >
          <option value="">— ללא —</option>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
      </Row>

      <Row icon={Mic} label="רשימות הקלטות" align="start">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Assigned chips */}
          {assignments.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {assignments.map((a) => {
                const list = recordingLists.find((l) => l.id === a.list_id);
                return (
                  <span
                    key={a.list_id}
                    className="chip-accent inline-flex items-center gap-1"
                  >
                    {list?.emoji ? `${list.emoji} ` : ""}
                    {list?.name ?? "(רשימה ארוכבה)"}
                    <button
                      onClick={() =>
                        unassignList.mutate({
                          recordingId: recording.id,
                          listId: a.list_id,
                        })
                      }
                      className="hover:text-danger-700"
                      aria-label="הסר מרשימה"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-ink-500 text-[11px]">לא משויך לאף רשימה</p>
          )}

          {/* Add to existing list */}
          {availableLists.length > 0 && (
            <select
              className="field !py-1 !px-2 !text-xs"
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                assignList.mutate({ recordingId: recording.id, listId: id });
              }}
            >
              <option value="">+ הוספה לרשימה קיימת…</option>
              {availableLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.emoji ? `${l.emoji} ` : ""}
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Create new list inline */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateAndAssign();
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              placeholder="רשימה חדשה…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
              disabled={creating}
            />
            <button
              type="submit"
              disabled={!newListName.trim() || creating}
              className={cn(
                "btn-ghost !py-1 !px-2",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="צרי רשימה ושייכי"
            >
              <Plus className="w-3 h-3" />
            </button>
          </form>
        </div>
      </Row>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  align = "center",
  children,
}: {
  icon: typeof FolderKanban;
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2",
        align === "start" ? "items-start pt-1" : "items-center"
      )}
    >
      <div className="inline-flex items-center gap-1 text-ink-600 shrink-0 w-32">
        <Icon className="w-3.5 h-3.5 text-ink-500" />
        <span>{label}:</span>
      </div>
      {children}
    </div>
  );
}
