import { useState } from "react";
import {
  X,
  Check,
  Calendar as CalendarIcon,
  FolderInput,
  Trash2,
  AlertCircle,
  UserPlus,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  useMoveTaskToList,
  useRestoreTasks,
  useDuplicateTaskTree,
} from "@/lib/hooks/useTasks";
import { fetchTaskSubtree } from "@/lib/services/tasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useHiddenProjectListIds } from "@/lib/hooks/useProjects";
import {
  useAddTaskAssignee,
} from "@/lib/hooks/useTaskAssignees";
import { useSetTaskShare } from "@/lib/hooks/useTaskShares";
import { useUserOrganizations } from "@/lib/hooks/useOrganizations";
import { useOrgMembersForOrg } from "@/lib/hooks/useOrgMembers";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTaskSelectionStore } from "@/lib/selection/store";
import { pushUndo } from "@/lib/undo/store";
import { DateTimeField } from "@/components/ui/DateField";
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
  const restore = useRestoreTasks();
  const moveToList = useMoveTaskToList();
  const duplicateTree = useDuplicateTaskTree();
  const addAssignee = useAddTaskAssignee();
  const setShare = useSetTaskShare();
  const { user, activeOrganizationId } = useAuth();
  const { data: allOrgs = [] } = useUserOrganizations();
  const { data: allTaskLists = [] } = useTaskLists();
  const hiddenProjectListIds = useHiddenProjectListIds();
  const taskLists = allTaskLists.filter((l) => !hiddenProjectListIds.has(l.id));

  const [urgencyOpen, setUrgencyOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateOrgId, setDelegateOrgId] = useState<string | null>(null);
  const [delegateSelectedUsers, setDelegateSelectedUsers] = useState<
    Set<string>
  >(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const effectiveDelegateOrgId =
    delegateOrgId ?? activeOrganizationId ?? allOrgs[0]?.id ?? null;
  const { data: delegateOrgMembers = [] } = useOrgMembersForOrg(
    effectiveDelegateOrgId
  );

  const count = selected.size;
  if (count === 0) return null;

  const ids = Array.from(selected);
  const selectedTasks = allTasks.filter((t) => selected.has(t.id));

  const hasOtherSelected = Array.from(delegateSelectedUsers).some(
    (uid) => uid !== user?.id
  );

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

  const applyDelegate = () => {
    if (delegateSelectedUsers.size === 0 || !effectiveDelegateOrgId) return;
    const uidList = Array.from(delegateSelectedUsers);
    const firstUid = uidList[0]!;

    // Snapshot primary assignee per task — the only piece undo-able locally.
    // Assignee rows and shares we add are upserts; "undo" of them would
    // require knowing which were already present, which isn't loaded here.
    // The user can remove assignees per-task via the row edit modal.
    const prevPrimary = snapshot("assignee_user_id");

    for (const task of selectedTasks) {
      for (const uid of uidList) {
        addAssignee.mutate({
          taskId: task.id,
          userId: uid,
          orgId: effectiveDelegateOrgId,
        });
        if (uid !== user?.id) {
          // Mirrors TaskEditModal.handleAddAssignee: a non-self assignee
          // gets an automatic write share so the assignee can actually
          // open and update the task.
          setShare.mutate({
            orgId: effectiveDelegateOrgId,
            taskId: task.id,
            userId: uid,
            permission: "write",
          });
        }
      }
      // Mirror primary assignee on `tasks.assignee_user_id` only when the
      // task had no primary yet — preserves any pre-existing primary so a
      // bulk-add doesn't silently overwrite an intentional assignment.
      if (!task.assignee_user_id) {
        updateTask.mutate({
          taskId: task.id,
          patch: { assignee_user_id: firstUid },
        });
      }
    }

    pushUndo({
      description: `האצלה (${count})`,
      undo: () => {
        for (const [id, p] of prevPrimary) {
          updateTask.mutate({
            taskId: id,
            patch: { assignee_user_id: (p as string | null) ?? null },
          });
        }
      },
      redo: () => {
        for (const task of selectedTasks) {
          if (!task.assignee_user_id) {
            updateTask.mutate({
              taskId: task.id,
              patch: { assignee_user_id: firstUid },
            });
          }
        }
      },
    });

    setDelegateOpen(false);
    setDelegateSelectedUsers(new Set());
  };

  const applyDelete = async () => {
    // Snapshot every selected subtree first so the whole batch can be undone.
    // Selecting a parent also selects its descendants, so the same task can be
    // reached via several roots — dedupe by id and order parents-before-children
    // so the restore re-inserts without FK/PK errors.
    const byId = new Map<string, Task>();
    for (const id of ids) {
      try {
        for (const t of await fetchTaskSubtree(id)) byId.set(t.id, t);
      } catch (e) {
        console.error("bulk delete: subtree snapshot failed", e);
      }
    }
    const ordered: Task[] = [];
    const emitted = new Set<string>();
    const visit = (t: Task) => {
      if (emitted.has(t.id)) return;
      const parent = t.parent_task_id ? byId.get(t.parent_task_id) : undefined;
      if (parent && !emitted.has(parent.id)) visit(parent);
      emitted.add(t.id);
      ordered.push(t);
    };
    byId.forEach((t) => visit(t));

    const count = ids.length;
    const redo = () => {
      for (const id of ids) deleteTask.mutate(id);
    };
    redo();
    setConfirmDelete(false);
    clear();
    if (ordered.length > 0) {
      pushUndo({
        description: `מחיקת ${count} משימות`,
        undo: () => restore.mutate(ordered),
        redo,
      });
    }
  };

  const applyDuplicate = async () => {
    // Selecting a parent auto-selects its whole subtree, and duplicateTaskTree
    // copies the subtree too. So we only duplicate the selection "roots" —
    // selected tasks that have no selected ancestor — otherwise nested
    // subtasks would also be cloned standalone, producing orphan copies.
    const taskById = new Map(allTasks.map((t) => [t.id, t]));
    const hasSelectedAncestor = (t: Task): boolean => {
      let cur = t.parent_task_id;
      while (cur) {
        if (selected.has(cur)) return true;
        cur = taskById.get(cur)?.parent_task_id ?? null;
      }
      return false;
    };
    const roots = selectedTasks.filter((t) => !hasSelectedAncestor(t));
    if (roots.length === 0) return;

    // createdIds is mutable so a redo refreshes it (each duplication mints new
    // ids), keeping a subsequent undo able to remove the latest copies.
    let createdIds: string[] = [];
    const run = async () => {
      const fresh: string[] = [];
      for (const t of roots) {
        try {
          fresh.push(await duplicateTree.mutateAsync({ sourceTaskId: t.id }));
        } catch (e) {
          console.error("bulk duplicate failed for", t.id, e);
        }
      }
      createdIds = fresh;
    };

    await run();
    clear();
    if (createdIds.length > 0) {
      pushUndo({
        description: `שכפול ${roots.length} משימות`,
        undo: () => {
          for (const id of createdIds) deleteTask.mutate(id);
        },
        redo: () => {
          void run();
        },
      });
    }
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
                <DateTimeField
                  value={scheduleDraft}
                  onChange={setScheduleDraft}
                  className="w-full"
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

        {/* Delegate */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDelegateOpen((v) => !v)}
            className="px-2 py-1 rounded-md hover:bg-white/10 text-xs inline-flex items-center gap-1"
            title="האצלה"
          >
            <UserPlus className="w-3.5 h-3.5" />
            האצלה
          </button>
          {delegateOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDelegateOpen(false)}
              />
              <div className="absolute bottom-full mb-1 start-0 z-40 bg-white text-ink-900 border border-ink-200 rounded-xl shadow-lift p-3 w-72 space-y-2">
                {allOrgs.length > 1 && (
                  <select
                    value={effectiveDelegateOrgId ?? ""}
                    onChange={(e) => setDelegateOrgId(e.target.value)}
                    className="field text-sm w-full"
                  >
                    {allOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex flex-col gap-0.5 max-h-44 overflow-auto rounded-lg border border-ink-200 p-1.5">
                  {delegateOrgMembers.length === 0 && (
                    <p className="text-xs text-ink-400 px-1.5 py-1">
                      אין חברי ארגון להאצלה.
                    </p>
                  )}
                  {delegateOrgMembers.map((m) => {
                    const uid = m.membership.user_id;
                    const isSelf = uid === user?.id;
                    const checked = delegateSelectedUsers.has(uid);
                    const name = m.profile?.full_name ?? uid;
                    return (
                      <label
                        key={uid}
                        className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-ink-50 cursor-pointer text-sm select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setDelegateSelectedUsers((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(uid);
                              else next.delete(uid);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded accent-primary-500"
                        />
                        <span className="truncate">
                          {name}
                          {isSelf && (
                            <span className="text-ink-400"> (אני)</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {hasOtherSelected && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                    ⚠️ האצלה למשתמשים אחרים משתפת איתם את המשימה — הם יוכלו לראות
                    ולערוך אותה.
                  </p>
                )}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={applyDelegate}
                    disabled={
                      delegateSelectedUsers.size === 0 ||
                      !effectiveDelegateOrgId
                    }
                    className="btn-primary text-xs disabled:opacity-50"
                  >
                    החל ל-{count}
                  </button>
                </div>
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

        {/* Duplicate */}
        <button
          type="button"
          onClick={applyDuplicate}
          disabled={duplicateTree.isPending}
          className="px-2 py-1 rounded-md hover:bg-white/10 text-xs inline-flex items-center gap-1 disabled:opacity-50"
          title="שכפל את המשימות המסומנות (כולל תת-משימות)"
        >
          <Copy className="w-3.5 h-3.5" />
          שכפל
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
