import { useState } from "react";
import {
  X,
  Check,
  Calendar as CalendarIcon,
  FolderInput,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  useMoveTaskToList,
} from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useTaskSelectionStore } from "@/lib/selection/store";
import { pushUndo } from "@/lib/undo/store";
import type { Task } from "@/lib/types/domain";

interface BulkActionsToolbarProps {
  /** All currently-loaded tasks — needed to snapshot prev state for undo. */
  allTasks: Task[];
}

/**
 * Floating action bar that appears at the bottom of the tasks screen when
 * one or more tasks are selected via the row checkboxes. Each action applies
 * to every selected task in parallel and is wrapped in a single undo entry
 * so Ctrl+Z reverses the whole batch.
 */
export function BulkActionsToolbar({ allTasks }: BulkActionsToolbarProps) {
  const selected = useTaskSelectionStore((s) => s.selected);
  const clear = useTaskSelectionStore((s) => s.clear);
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const moveToList = useMoveTaskToList();
  const { data: taskLists = [] } = useTaskLists();

  const [urgencyOpen, setUrgencyOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const count = selected.size;
  if (count === 0) return null;

  const ids = Array.from(selected);
  const selectedTasks = allTasks.filter((t) => selected.has(t.id));

  // Snapshot helper: returns a map of id → previous value for the given
  // field so undo can put each task back exactly where it was.
  const snapshot = <K extends keyof Task>(field: K) => {
    const m = new Map<string, Task[K]>();
    for (const t of selectedTasks) m.set(t.id, t[field]);
    return m;
  };

  const applyUrgency = (v: number) => {
    const prev = snapshot("urgency");
    for (const id of ids) {
      updateTask.mutate({ taskId: id, patch: { urgency: v } });
    }
    pushUndo({
      description: `שינוי דחיפות (${count})`,
      undo: () => {
        for (const [id, p] of prev) {
          updateTask.mutate({ taskId: id, patch: { urgency: p as number } });
        }
      },
      redo: () => {
        for (const id of ids) {
          updateTask.mutate({ taskId: id, patch: { urgency: v } });
        }
      },
    });
    setUrgencyOpen(false);
  };

  const applySchedule = () => {
    const iso = scheduleDraft ? new Date(scheduleDraft).toISOString() : null;
    const prev = snapshot("scheduled_at");
    for (const id of ids) {
      updateTask.mutate({ taskId: id, patch: { scheduled_at: iso } });
    }
    pushUndo({
      description: `תזמון (${count})`,
      undo: () => {
        for (const [id, p] of prev) {
          updateTask.mutate({
            taskId: id,
            patch: { scheduled_at: (p as string | null) ?? null },
          });
        }
      },
      redo: () => {
        for (const id of ids) {
          updateTask.mutate({ taskId: id, patch: { scheduled_at: iso } });
        }
      },
    });
    setScheduleOpen(false);
    setScheduleDraft("");
  };

  const applyMoveToList = (listId: string | null) => {
    const prev = snapshot("task_list_id");
    for (const id of ids) {
      moveToList.mutate({ taskId: id, listId });
    }
    pushUndo({
      description: `העברה לרשימה (${count})`,
      undo: () => {
        for (const [id, p] of prev) {
          moveToList.mutate({ taskId: id, listId: (p as string | null) ?? null });
        }
      },
      redo: () => {
        for (const id of ids) {
          moveToList.mutate({ taskId: id, listId });
        }
      },
    });
    setListOpen(false);
  };

  const applyComplete = () => {
    // Snapshot both completed_at AND status — completeTask() mutates both
    // (status → "done"/"todo"), so undo has to put each task back to its
    // exact prior state, not just clear completed_at and let status drift.
    const prevCompleted = snapshot("completed_at");
    const prevStatus = snapshot("status");
    for (const id of ids) {
      completeTask.mutate({ taskId: id, completed: true });
    }
    pushUndo({
      description: `סימון השלמה (${count})`,
      undo: () => {
        for (const id of ids) {
          const wasCompleted = prevCompleted.get(id);
          // If the task was already completed pre-bulk, leave it alone.
          if (wasCompleted != null) continue;
          // Otherwise restore both fields with a single update — bypassing
          // completeTask() because that would force status to "todo" even
          // if the task was previously "in_progress" or another value.
          updateTask.mutate({
            taskId: id,
            patch: {
              completed_at: null,
              status: (prevStatus.get(id) as string | undefined) ?? "todo",
            },
          });
        }
      },
      redo: () => {
        for (const id of ids) {
          completeTask.mutate({ taskId: id, completed: true });
        }
      },
    });
    clear();
  };

  const applyDelete = () => {
    // Delete cascades children at the DB level; no undo (matches per-row
    // delete behaviour). We confirm before applying for safety.
    for (const id of ids) deleteTask.mutate(id);
    setConfirmDelete(false);
    clear();
  };

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-ink-900 text-white rounded-2xl shadow-lift px-2 py-1.5 text-sm"
        role="toolbar"
        aria-label="פעולות על משימות מסומנות"
      >
        <span className="px-2 font-mono tabular-nums text-xs">
          {count} מסומנות
        </span>
        <div className="w-px h-5 bg-white/20 mx-1" />

        {/* Urgency */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUrgencyOpen((v) => !v)}
            className="px-2 py-1 rounded-md hover:bg-white/10 text-xs"
            title="שינוי דחיפות"
          >
            דחיפות
          </button>
          {urgencyOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setUrgencyOpen(false)}
              />
              <div className="absolute bottom-full mb-1 start-0 z-40 bg-white text-ink-900 border border-ink-200 rounded-xl shadow-lift p-2 flex items-center gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => applyUrgency(n)}
                    className="flex flex-col items-center gap-1 p-1 rounded-md hover:bg-ink-100 min-w-[36px]"
                    title={n === 0 ? "ללא דירוג" : `${n}/3`}
                  >
                    {n === 0 ? (
                      <span className="text-ink-400 text-xs h-[21px] flex items-center">
                        ∅
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-[3px]">
                        {[3, 2, 1].map((row) => (
                          <span
                            key={row}
                            className={cn(
                              "h-[3px] w-5 rounded-sm",
                              row <= n ? "bg-ink-900" : "bg-ink-200"
                            )}
                          />
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-ink-500">{n}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Schedule */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setScheduleOpen((v) => !v)}
            className="px-2 py-1 rounded-md hover:bg-white/10 text-xs inline-flex items-center gap-1"
            title="תזמון"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            תזמון
          </button>
          {scheduleOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setScheduleOpen(false)}
              />
              <div className="absolute bottom-full mb-1 start-0 z-40 bg-white text-ink-900 border border-ink-200 rounded-xl shadow-lift p-3 w-72 space-y-2">
                <input
                  type="datetime-local"
                  value={scheduleDraft}
                  onChange={(e) => setScheduleDraft(e.target.value)}
                  className="field text-sm w-full"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleDraft("");
                      applySchedule();
                    }}
                    className="text-xs text-ink-500 hover:text-danger-500"
                  >
                    הסר תזמון
                  </button>
                  <button
                    type="button"
                    onClick={applySchedule}
                    disabled={!scheduleDraft}
                    className="btn-primary text-xs disabled:opacity-50"
                  >
                    החל ל-{count}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Move to list */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="px-2 py-1 rounded-md hover:bg-white/10 text-xs inline-flex items-center gap-1"
            title="העברה לרשימה"
          >
            <FolderInput className="w-3.5 h-3.5" />
            רשימה
          </button>
          {listOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setListOpen(false)}
              />
              <div className="absolute bottom-full mb-1 start-0 z-40 bg-white text-ink-900 border border-ink-200 rounded-xl shadow-lift py-1 w-56 max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => applyMoveToList(null)}
                  className="w-full text-start px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100"
                >
                  לא משויכת
                </button>
                {taskLists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => applyMoveToList(l.id)}
                    className="w-full text-start px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100"
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Complete */}
        <button
          type="button"
          onClick={applyComplete}
          className="px-2 py-1 rounded-md hover:bg-white/10 text-xs inline-flex items-center gap-1"
          title="סמן הושלם"
        >
          <Check className="w-3.5 h-3.5" />
          הושלם
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="px-2 py-1 rounded-md hover:bg-danger-500/20 text-xs inline-flex items-center gap-1 text-danger-300"
          title="מחק"
        >
          <Trash2 className="w-3.5 h-3.5" />
          מחק
        </button>

        <div className="w-px h-5 bg-white/20 mx-1" />

        <button
          type="button"
          onClick={clear}
          className="p-1 rounded-md hover:bg-white/10"
          title="בטל בחירה (Esc)"
          aria-label="בטל בחירה"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-ink-900 inline-flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-danger-500" />
              מחיקה מרובה
            </h3>
            <p className="text-sm text-ink-600">
              זה ימחק {count} משימות לצמיתות (וגם את כל תת-המשימות שלהן אם יש).
              הפעולה לא ניתנת לביטול.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-ghost text-xs"
                type="button"
              >
                בטל
              </button>
              <button
                onClick={applyDelete}
                className="text-xs inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 font-medium bg-danger-500 text-white hover:bg-danger-600 transition-colors"
                type="button"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק את {count}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
