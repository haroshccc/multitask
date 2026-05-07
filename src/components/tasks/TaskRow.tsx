import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Play,
  Pause,
  MoreHorizontal,
  Copy,
  CopyPlus,
  FolderInput,
  Pencil,
  GripVertical,
  CornerDownLeft,
  Trash2,
  ChevronLeft,
  Repeat2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCompleteTask,
  useToggleOccurrence,
  useUpdateTask,
  useCreateTask,
  useSetTaskParent,
  useDuplicateTaskTree,
  useDuplicateTask,
  useDeleteTask,
  useRestoreTasks,
} from "@/lib/hooks/useTasks";
import * as tasksService from "@/lib/services/tasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/hooks/useTimer";
import { useTimeUnit, formatSeconds } from "@/lib/hooks/useTimeUnit";
import { useMyTaskStatuses } from "@/lib/hooks/useUserTaskStatuses";
import type { RowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { pushUndo } from "@/lib/undo/store";
import {
  isRecurring as isTaskRecurring,
  getActiveOccurrence,
  getCompletedOccurrences,
  formatRelativeOccurrence,
} from "@/lib/tasks/recurrence";
import {
  useIsTaskSelected,
  useTaskSelectionStore,
} from "@/lib/selection/store";
import {
  Link as LinkIcon,
  Calendar as CalendarIcon,
  AlertTriangle,
} from "lucide-react";
import { PlanVsActualBar } from "@/components/tasks/PlanVsActualBar";
import { useAuth } from "@/lib/auth/AuthContext";
import { HalfCheckIcon } from "@/components/ui/HalfCheckIcon";
import type { Task } from "@/lib/types/domain";

export interface TaskTreeNode {
  task: Task;
  children: TaskTreeNode[];
  depth: number;
}

interface TaskRowProps {
  node: TaskTreeNode;
  /** Previous sibling task id — used to Tab-indent under it */
  prevSiblingId: string | null;
  /** Parent task (null for roots) — used to Shift+Tab outdent */
  parentTaskId: string | null;
  /** Grandparent task id — outdent target */
  grandparentTaskId: string | null;
  /** The list this subtree belongs to */
  listId: string | null;
  /** Call to focus next sibling after Enter-create */
  onRequestFocus: (taskId: string) => void;
  /** Which task should auto-focus next render (set by parent after create) */
  focusTaskId: string | null;
  onOpenEdit: (taskId: string) => void;
  /** Per-user pref of which inline badges to render */
  display: RowDisplayPrefs;
  /** When true the row is view-only: no edits, completions, or mutations */
  readOnly?: boolean;
}

export function TaskRow({
  node,
  prevSiblingId,
  parentTaskId,
  grandparentTaskId,
  listId,
  onRequestFocus,
  focusTaskId,
  onOpenEdit,
  display,
  readOnly = false,
}: TaskRowProps) {
  const { task, children, depth } = node;
  const { user } = useAuth();
  // Task ownership visual modes:
  // 'mine'       — I own AND execute (owner==me, no assignee or assignee==me)
  // 'delegated'  — I own but someone else executes (owner==me, assignee!=me)
  // 'assigned'   — Someone else owns, I execute (assignee==me, owner!=me)
  const taskOwnershipMode: "mine" | "delegated" | "assigned" =
    user && task.owner_id !== user.id && task.assignee_user_id === user.id
      ? "assigned"
      : user && task.owner_id === user.id && task.assignee_user_id && task.assignee_user_id !== user.id
      ? "delegated"
      : "mine";

  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const toggleOccurrence = useToggleOccurrence();
  const createTask = useCreateTask();
  const setParent = useSetTaskParent();
  const duplicateTree = useDuplicateTaskTree();
  const duplicateOne = useDuplicateTask();
  const deleteTaskM = useDeleteTask();
  const restoreTasks = useRestoreTasks();
  const { data: taskLists = [] } = useTaskLists();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: activeTimer } = useActiveTimer();

  const [draft, setDraft] = useState(task.title);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    right?: number;
    left?: number;
  } | null>(null);
  const [duplicateToListOpen, setDuplicateToListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const el = menuTriggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      // Anchor to whichever edge keeps the menu on-screen. In RTL the ⋯
      // button lands near the left edge; using `right` there would push the
      // menu far off-screen to the left.
      if (r.left < window.innerWidth / 2) {
        setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.left) });
      } else {
        setMenuPos({
          top: r.bottom + 4,
          right: Math.max(8, window.innerWidth - r.right),
        });
      }
    }
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setDuplicateToListOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onScroll = () => closeMenu();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [menuOpen]);

  const [timeUnit] = useTimeUnit();
  const { data: myStatuses = [] } = useMyTaskStatuses();

  const isActive = activeTimer?.task_id === task.id;
  const isDone = !!task.completed_at;

  // Total (including nested) + completed counts — for the compact "N/M" badge.
  const totalInSubtree = countDescendants(children);
  const doneInSubtree = countCompletedDescendants(children);

  // keep draft in sync when task title changes externally (e.g. realtime)
  useEffect(() => {
    setDraft(task.title);
  }, [task.title]);

  // auto-focus when parent just created this row
  useEffect(() => {
    if (focusTaskId === task.id) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusTaskId, task.id]);

  const commitTitle = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === task.title) {
      setDraft(task.title);
      return;
    }
    const prevTitle = task.title;
    updateTask.mutate({ taskId: task.id, patch: { title: trimmed } });
    pushUndo({
      description: "שינוי כותרת",
      undo: () =>
        updateTask.mutate({ taskId: task.id, patch: { title: prevTitle } }),
      redo: () =>
        updateTask.mutate({ taskId: task.id, patch: { title: trimmed } }),
    });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitTitle();
      // Create new sibling right after this one.
      const payload = {
        title: "",
        task_list_id: listId ?? null,
        parent_task_id: parentTaskId,
        status: "todo",
        urgency: 0,
      };
      const newTask = await createTask.mutateAsync(payload);
      pushUndo({
        description: "יצירת משימה",
        undo: () => deleteTaskM.mutate(newTask.id),
        redo: () => createTask.mutate(payload),
      });
      onRequestFocus(newTask.id);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      // Indent: make this a child of previous sibling.
      if (!prevSiblingId) return;
      e.preventDefault();
      commitTitle();
      const prevParent = task.parent_task_id;
      setParent.mutate({ taskId: task.id, parentId: prevSiblingId });
      pushUndo({
        description: "הזחה",
        undo: () => setParent.mutate({ taskId: task.id, parentId: prevParent }),
        redo: () => setParent.mutate({ taskId: task.id, parentId: prevSiblingId }),
      });
      return;
    }
    if (e.key === "Tab" && e.shiftKey) {
      // Outdent: promote one level. Only possible if this is a child.
      if (!parentTaskId) return;
      e.preventDefault();
      commitTitle();
      const prevParent = task.parent_task_id;
      setParent.mutate({ taskId: task.id, parentId: grandparentTaskId });
      pushUndo({
        description: "הקטנת רמה",
        undo: () => setParent.mutate({ taskId: task.id, parentId: prevParent }),
        redo: () =>
          setParent.mutate({ taskId: task.id, parentId: grandparentTaskId }),
      });
      return;
    }
    if (e.key === "Escape") {
      setDraft(task.title);
      inputRef.current?.blur();
    }
  };

  // Pending-complete state: a 500ms grace window between the click and the
  // actual mutation. The circle fills green immediately so the user sees
  // confirmation, but the row only moves to "completed" after the delay.
  // A second click during the window cancels the pending completion (so
  // accidental clicks are reversible without ever hitting the DB).
  const [pendingComplete, setPendingComplete] = useState(false);
  const pendingTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    };
  }, []);

  // Recurring task state — drives the row's "active occurrence" semantics.
  // A row is recurring when it has both a recurrence rule and a scheduled
  // anchor. The active occurrence is the next non-completed instance in
  // the lookahead window; when it's in the past (or now), the row reads
  // as bright "do this now". When it's in the future or there's no active
  // occurrence at all, the row reads as dim+✓ ("done for now, will wake
  // up automatically when the next slot becomes due").
  const taskIsRecurring = isTaskRecurring(task);
  const now = new Date();
  const activeOccurrence = taskIsRecurring ? getActiveOccurrence(task, now) : null;
  const recurringSlotIsPast = !!activeOccurrence && activeOccurrence <= now;

  const showAsDone = taskIsRecurring
    ? // Dim if no active occurrence in window, OR active is in the future
      // (= we just completed the most recent slot, nothing to do until next).
      // pendingComplete keeps the green check on during the 500ms grace.
      pendingComplete || !recurringSlotIsPast
    : isDone || pendingComplete;

  const toggleComplete = () => {
    // Cancel a pending click (works for both recurring and non-recurring).
    if (pendingComplete) {
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      setPendingComplete(false);
      return;
    }

    if (taskIsRecurring) {
      if (recurringSlotIsPast && activeOccurrence) {
        // BRIGHT → DIM: mark the active (overdue/now) occurrence done after
        // the 500ms grace.
        setPendingComplete(true);
        pendingTimerRef.current = window.setTimeout(() => {
          toggleOccurrence.mutate({
            taskId: task.id,
            occurrenceStart: activeOccurrence,
            next: true,
          });
          pushUndo({
            description: "סימון מופע",
            undo: () =>
              toggleOccurrence.mutate({
                taskId: task.id,
                occurrenceStart: activeOccurrence,
                next: false,
              }),
            redo: () =>
              toggleOccurrence.mutate({
                taskId: task.id,
                occurrenceStart: activeOccurrence,
                next: true,
              }),
          });
          pendingTimerRef.current = null;
        }, 500);
        return;
      }
      // DIM → BRIGHT: un-mark the most recent completed occurrence at-or
      // -before now (the user is undoing a previous completion). Instant —
      // no grace window because they can re-click to redo.
      const completed = getCompletedOccurrences(task);
      const latest = completed
        .filter((iso) => new Date(iso).getTime() <= now.getTime())
        .sort()
        .reverse()[0];
      if (latest) {
        const occ = new Date(latest);
        toggleOccurrence.mutate({
          taskId: task.id,
          occurrenceStart: occ,
          next: false,
        });
        pushUndo({
          description: "ביטול סימון מופע",
          undo: () =>
            toggleOccurrence.mutate({
              taskId: task.id,
              occurrenceStart: occ,
              next: true,
            }),
          redo: () =>
            toggleOccurrence.mutate({
              taskId: task.id,
              occurrenceStart: occ,
              next: false,
            }),
        });
      }
      return;
    }

    if (isDone) {
      // Un-completing: instant, no delay.
      completeTask.mutate({ taskId: task.id, completed: false });
      pushUndo({
        description: "ביטול השלמה",
        undo: () => completeTask.mutate({ taskId: task.id, completed: true }),
        redo: () => completeTask.mutate({ taskId: task.id, completed: false }),
      });
      return;
    }
    // Completing: show green check now, fire mutation after 500ms.
    setPendingComplete(true);
    pendingTimerRef.current = window.setTimeout(() => {
      completeTask.mutate({ taskId: task.id, completed: true });
      pushUndo({
        description: "סימון השלמה",
        undo: () => completeTask.mutate({ taskId: task.id, completed: false }),
        redo: () => completeTask.mutate({ taskId: task.id, completed: true }),
      });
      pendingTimerRef.current = null;
    }, 500);
  };

  const toggleTimer = () => {
    if (isActive) stopTimer.mutate();
    else startTimer.mutate({ taskId: task.id });
  };

  const handleDuplicateSingle = () => {
    duplicateOne.mutate({ sourceTaskId: task.id });
    closeMenu();
  };

  const handleDuplicateTree = () => {
    duplicateTree.mutate({ sourceTaskId: task.id });
    closeMenu();
  };

  const handleDuplicateToList = (targetListId: string | null) => {
    duplicateTree.mutate({
      sourceTaskId: task.id,
      targetListId: targetListId ?? undefined,
    });
    closeMenu();
  };

  const handleDelete = async () => {
    const taskId = task.id;
    // Snapshot the subtree (root + descendants) before deleting so undo can
    // restore the whole branch with the original ids and parent links.
    let subtree: Awaited<ReturnType<typeof tasksService.fetchTaskSubtree>> = [];
    try {
      subtree = await tasksService.fetchTaskSubtree(taskId);
    } catch (err) {
      console.error("delete: failed to snapshot subtree", err);
    }
    deleteTaskM.mutate(taskId);
    setConfirmDelete(false);
    closeMenu();
    if (subtree.length > 0) {
      pushUndo({
        description:
          subtree.length > 1
            ? `מחיקת משימה (${subtree.length} פריטים)`
            : "מחיקת משימה",
        undo: () => restoreTasks.mutate(subtree),
        redo: () => deleteTaskM.mutate(taskId),
      });
    }
  };

  const handleAddSubtask = async () => {
    const payload = {
      title: "",
      task_list_id: listId ?? null,
      parent_task_id: task.id,
      status: "todo",
      urgency: 0,
    };
    const newTask = await createTask.mutateAsync(payload);
    pushUndo({
      description: "הוספת תת-משימה",
      undo: () => deleteTaskM.mutate(newTask.id),
      redo: () => createTask.mutate(payload),
    });
    setCollapsed(false);
    onRequestFocus(newTask.id);
  };

  // DnD — the row is both a drag source AND three drop targets:
  //   - top 25% strip → drop *before* this row (sibling above)
  //   - middle 50% → nest as a child of this row
  //   - bottom 25% → drop *after* this row (sibling below)
  // Three zones lets the user reorder siblings AND nest with the same drag,
  // disambiguated only by where they release. A visual indicator (top/bottom
  // line, or full-row tint for nest) shows what will happen before they let go.
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `task:${task.id}`,
    data: { type: "task", taskId: task.id, listId, parentTaskId },
  });

  const { setNodeRef: setBeforeRef, isOver: isOverBefore } = useDroppable({
    id: `task-before:${task.id}`,
    data: {
      type: "task-before",
      taskId: task.id,
      listId,
      parentTaskId,
    },
  });

  const { setNodeRef: setNestRef, isOver: isOverNest } = useDroppable({
    id: `task-nest:${task.id}`,
    data: { type: "task-nest", taskId: task.id, listId },
  });

  const { setNodeRef: setAfterRef, isOver: isOverAfter } = useDroppable({
    id: `task-after:${task.id}`,
    data: {
      type: "task-after",
      taskId: task.id,
      listId,
      parentTaskId,
    },
  });

  const isPhase = task.is_phase === true;

  const isSelected = useIsTaskSelected(task.id);

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useTaskSelectionStore.getState();
    if (e.shiftKey) {
      store.shiftSelect(task.id);
    } else {
      // Selecting a parent automatically selects the whole subtree —
      // the user expects "I clicked one row, the things hanging off it
      // come with me". Clicking again on the parent deselects it all.
      const descendantIds = collectDescendantIds(children);
      if (descendantIds.length > 0) {
        store.toggleSubtree(task.id, descendantIds);
      } else {
        store.toggle(task.id);
      }
    }
  };

  return (
    <>
      <div
        ref={setDragRef}
        className={cn(
          "group relative flex items-start gap-1.5 rounded-md transition-colors px-1.5 py-1 hover:bg-ink-50",
          // Ownership visual modes — border style only (no bg tint, avoids conflict with list colors)
          taskOwnershipMode === "assigned" && !isSelected && "border border-dotted border-ink-400",
          taskOwnershipMode === "delegated" && !isSelected && "border border-dashed border-ink-400",
          isDragging && "opacity-40",
          isOverNest && "bg-primary-50 ring-1 ring-primary-300",
          isSelected && "bg-primary-50/60 ring-1 ring-primary-300",
          // Recurring tasks whose current slot is already done go dim. The
          // row "wakes up" automatically when the next occurrence's time
          // becomes due (the active-occurrence calc re-runs on every render).
          taskIsRecurring && showAsDone && !isSelected && "opacity-60",
          // Phase rows get a colored stripe on the leading edge, slightly
          // larger font, and a subtle background tint to read as a
          // group-header visually.
          isPhase &&
            "border-s-4 bg-[color:var(--list-color,#6b6b80)]/5 py-1.5 text-[14px] font-semibold"
        )}
        style={{
          paddingInlineStart: depth * 18 + 4,
          ...(isPhase
            ? ({ borderInlineStartColor: "var(--list-color, #6b6b80)" } as React.CSSProperties)
            : {}),
        }}
      >
        {/* Drop zones — three invisible strips. pointer-events:none so they
            don't intercept clicks on the row itself; dnd-kit detects collisions
            by element rect, not pointer events. */}
        <div
          ref={setBeforeRef}
          className="absolute top-0 inset-x-0 h-1/4 pointer-events-none"
          aria-hidden
        />
        <div
          ref={setNestRef}
          className="absolute top-1/4 inset-x-0 h-1/2 pointer-events-none"
          aria-hidden
        />
        <div
          ref={setAfterRef}
          className="absolute bottom-0 inset-x-0 h-1/4 pointer-events-none"
          aria-hidden
        />
        {/* Visual cue: 2px colored line at the top/bottom edge while a drag
            hovers in the corresponding zone. */}
        {isOverBefore && (
          <div
            className="absolute top-0 inset-x-1 h-0.5 bg-primary-500 rounded-full pointer-events-none"
            aria-hidden
          />
        )}
        {isOverAfter && (
          <div
            className="absolute bottom-0 inset-x-1 h-0.5 bg-primary-500 rounded-full pointer-events-none"
            aria-hidden
          />
        )}
        {/* Selection checkbox — appears on hover, or always when selected.
            Cmd/Ctrl+click also works on the row directly via the title input
            (handled in handleKeyDown), but the visible checkbox is the
            primary affordance. Shift+click extends a range from the anchor. */}
        <button
          type="button"
          onClick={handleSelectClick}
          aria-label={isSelected ? "בטל סימון" : "סמן משימה"}
          aria-pressed={isSelected}
          className={cn(
            "shrink-0 mt-1 w-3 h-3 rounded-[3px] border-2 flex items-center justify-center transition-all",
            isSelected
              ? "bg-primary-500 border-primary-500 text-white opacity-100"
              : "border-ink-300 hover:border-primary-500 opacity-0 group-hover:opacity-100"
          )}
        >
          {isSelected && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Drag handle — hidden for read-only viewers */}
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-ink-400 hover:text-ink-700 pt-1 shrink-0"
            aria-label="גרור"
            type="button"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        {readOnly && <span className="w-3.5 shrink-0" />}

        {/* Expand / collapse chevron */}
        {children.length > 0 ? (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="shrink-0 text-ink-400 hover:text-ink-700 pt-1"
            aria-label={collapsed ? "הרחב" : "כווץ"}
            type="button"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                collapsed ? "rotate-90" : "rotate-0"
              )}
            >
              <path d="M5 7l5 6 5-6H5z" />
            </svg>
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Completion circle — always green when done, gray border otherwise.
            Uses showAsDone so the click→500ms grace window shows the green
            check immediately. */}
        <button
          onClick={readOnly ? undefined : toggleComplete}
          disabled={readOnly}
          className={cn(
            "mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
            showAsDone
              ? "bg-success-500 border-success-500 text-white"
              : readOnly
              ? "border-ink-200 cursor-default"
              : "border-ink-300 hover:border-success-500"
          )}
          aria-label={showAsDone ? "בטל סימון" : "סמן כהושלמה"}
          type="button"
        >
          {showAsDone && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Phase badge — visible chip so the row reads as a header */}
        {isPhase && (
          <span
            className="shrink-0 self-center inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: "var(--list-color, #6b6b80)" }}
            title="שלב — פריט שמקבץ תחתיו תתי-משימות"
          >
            שלב
          </span>
        )}

        {/* Title input */}
        <input
          ref={inputRef}
          value={draft}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (e) => setDraft(e.target.value)}
          onBlur={readOnly ? undefined : commitTitle}
          onKeyDown={readOnly ? undefined : handleKeyDown}
          onDoubleClick={readOnly ? undefined : () => onOpenEdit(task.id)}
          placeholder="משימה חדשה..."
          className={cn(
            "flex-1 min-w-0 bg-transparent border-0 outline-none text-sm py-0.5",
            readOnly && "cursor-default select-text",
            !taskIsRecurring && showAsDone && "line-through text-ink-400"
          )}
        />

        {/* Ownership mode micro-labels — keep small, no bg tint (border already signals mode) */}
        {taskOwnershipMode === "assigned" && (
          <span className="shrink-0 text-[9px] text-ink-500 font-medium leading-none">הוצאל</span>
        )}
        {taskOwnershipMode === "delegated" && (
          <span className="shrink-0 text-[9px] text-ink-500 font-medium leading-none">האצלתי</span>
        )}
        {/* Pending-approval half-check — clickable by approver, static badge for everyone else */}
        {task.status === "pending_approval" && (
          <HalfCheckIcon
            size={14}
            onApprove={
              user && task.approver_user_id === user.id
                ? (e) => {
                    e.stopPropagation();
                    updateTask.mutate({
                      taskId: task.id,
                      patch: {
                        status: "done",
                        approved_at: new Date().toISOString(),
                        completed_at: new Date().toISOString(),
                      },
                    });
                  }
                : undefined
            }
          />
        )}

        {/* Recurrence indicator — small ↻ icon plus the next occurrence
            label ("היום 9:00", "מחר 9:00", "ב-15 במאי 9:00"). Always visible
            on recurring rows so the user can tell at a glance which tasks
            repeat. */}
        {taskIsRecurring && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 text-[11px] text-ink-500 tabular-nums",
              showAsDone && "text-ink-400"
            )}
            title="משימה חוזרת"
          >
            <Repeat2 className="w-3 h-3" />
            {activeOccurrence ? formatRelativeOccurrence(activeOccurrence, now) : null}
            {showAsDone && taskIsRecurring && (
              <span
                className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-success-500/15 text-success-600"
                title="המופע הקרוב סומן כבוצע"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2">
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </span>
        )}

        {/* Goal indicator — small 🎯 chip when this task is configured as
            a goal/habit. The Goals screen shows the streak number; here we
            just signal at a glance that this row contributes to a goal. */}
        {task.goal_period && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 text-[11px] text-primary-700 bg-primary-50 border border-primary-200 px-1.5 py-0.5 rounded-full",
              showAsDone && "opacity-60"
            )}
            title={
              task.goal_period === "day"
                ? `יעד: ${task.goal_target ?? 1} פעמים ביום`
                : task.goal_period === "week"
                  ? `יעד: ${task.goal_target ?? 1} פעמים בשבוע`
                  : `יעד: ${task.goal_target ?? 1} פעמים בחודש`
            }
          >
            <Target className="w-3 h-3" />
          </span>
        )}

        {/* All inline badges + quick actions render on desktop only. On
            mobile they collapse into the ⋯ menu below to keep the row clean. */}
        <div className="hidden md:contents">
        {display.urgency && (
          <UrgencyChip
            value={task.urgency}
            onChange={(v) => {
              const prev = task.urgency;
              if (prev === v) return;
              updateTask.mutate({ taskId: task.id, patch: { urgency: v } });
              pushUndo({
                description: "שינוי דחיפות",
                undo: () =>
                  updateTask.mutate({
                    taskId: task.id,
                    patch: { urgency: prev },
                  }),
                redo: () =>
                  updateTask.mutate({
                    taskId: task.id,
                    patch: { urgency: v },
                  }),
              });
            }}
          />
        )}

        {display.subtasks && totalInSubtree > 0 && (
          <span
            className="shrink-0 text-[10px] font-mono tabular-nums text-ink-500 px-1.5 py-0.5 rounded-md bg-ink-100"
            title={`${doneInSubtree} מתוך ${totalInSubtree} תת-משימות הושלמו`}
          >
            {doneInSubtree}/{totalInSubtree}
          </span>
        )}

        {display.status && (() => {
          const s = myStatuses.find((x) => x.key === task.status);
          const color = s?.color ?? "#a8a8bc";
          const label = s?.label ?? task.status;
          return (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-[10px] text-ink-700 px-1.5 py-0.5 rounded-md bg-ink-100"
              title={`סטטוס: ${label}`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
            </span>
          );
        })()}

        {display.dueDate && task.scheduled_at && (
          <span
            className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100"
            title="זמן עבודה מתוכנן"
          >
            <CalendarIcon className="w-3 h-3" />
            {formatShortDate(task.scheduled_at)}
          </span>
        )}

        {/* Deadline — separate from scheduled_at. Shown always when set and
            not completed; severity coded by colour:
              red    = past deadline
              orange = within 24h
              ink    = further out */}
        {task.deadline_at && !isDone && (() => {
          const dl = new Date(task.deadline_at);
          const ms = dl.getTime() - Date.now();
          const tone =
            ms < 0
              ? "bg-danger-50 text-danger-700"
              : ms < 24 * 3600 * 1000
              ? "bg-warning-50 text-warning-700"
              : "bg-ink-100 text-ink-600";
          const titleText =
            ms < 0
              ? `דד-ליין עבר: ${formatShortDate(task.deadline_at)}`
              : `דד-ליין: ${formatShortDate(task.deadline_at)}`;
          return (
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                tone
              )}
              title={titleText}
            >
              <AlertTriangle className="w-3 h-3" />
              {formatShortDate(task.deadline_at)}
            </span>
          );
        })()}

        {display.estimated && task.estimated_hours != null && (
          <span
            className="shrink-0 text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100"
            title="זמן שהוקצה"
          >
            {formatHoursShort(task.estimated_hours)}
          </span>
        )}

        {display.estimatedVsActual && task.estimated_hours != null && (
          <span
            className="shrink-0 w-24 sm:w-28"
            onClick={(e) => e.stopPropagation()}
            title={`בפועל מתוך ${formatHoursShort(task.estimated_hours)}`}
          >
            <PlanVsActualBar
              estimatedSeconds={task.estimated_hours * 3600}
              actualSeconds={task.actual_seconds}
              compact
            />
          </span>
        )}

        {display.link && task.external_url && (
          <a
            href={task.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 p-0.5 rounded-md text-ink-400 hover:text-primary-700 hover:bg-ink-100"
            title={task.external_url}
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </a>
        )}

        {display.timer && (
          <button
            onClick={toggleTimer}
            className={cn(
              "shrink-0 p-1 rounded-md transition-colors",
              isActive
                ? "bg-primary-500 text-white hover:bg-primary-600"
                : "text-ink-400 hover:text-ink-900 hover:bg-ink-100"
            )}
            aria-label={isActive ? "עצור סטופר" : "התחל סטופר"}
            title={isActive ? "עצור סטופר" : "התחל סטופר"}
            type="button"
          >
            {isActive ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {display.timer && task.actual_seconds > 0 && (
          <button
            type="button"
            onClick={() => onOpenEdit(task.id)}
            className="shrink-0 text-[11px] font-mono tabular-nums text-ink-500 hover:text-primary-700 px-1 rounded-md"
            title="עריכת סשנים ויחידת מידה"
          >
            {formatSeconds(task.actual_seconds, timeUnit)}
          </button>
        )}

        {/* Outside action cluster: + subtask, edit pencil, overflow menu — hidden when read-only */}
        {!readOnly && (
          <button
            onClick={handleAddSubtask}
            className="shrink-0 p-1 rounded-md text-ink-400 hover:text-primary-700 hover:bg-primary-50 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="הוסף תת-משימה"
            title="הוסף תת-משימה"
            type="button"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {!readOnly && (
          <button
            onClick={() => onOpenEdit(task.id)}
            className="shrink-0 p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="ערוך פרטים"
            title="ערוך פרטים"
            type="button"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        </div>
        {/* end desktop-only badges wrapper */}

        {!readOnly && <div className="relative shrink-0">
          <button
            ref={menuTriggerRef}
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100 md:opacity-0 md:group-hover:opacity-100"
            aria-label="תפריט"
            type="button"
          >
            <MoreHorizontal className="w-4 h-4 md:w-3.5 md:h-3.5" />
          </button>
          {menuOpen && menuPos && createPortal(
            <>
              <div className="fixed inset-0 z-[60]" onClick={closeMenu} />
              <div
                className="fixed w-64 md:w-56 bg-white border border-ink-200 rounded-xl shadow-lift z-[61] py-1 text-sm max-h-[80vh] overflow-y-auto"
                style={{ top: menuPos.top, right: menuPos.right, left: menuPos.left }}
              >
                {/* Mobile-only: the inline badges collapsed into the menu as
                    interactive rows so the task row itself stays minimal. */}
                <div className="md:hidden">
                  <MenuBtn
                    icon={<CornerDownLeft className="w-3.5 h-3.5" />}
                    onClick={() => {
                      handleAddSubtask();
                      closeMenu();
                    }}
                  >
                    הוסף תת-משימה
                  </MenuBtn>
                  <MenuBtn
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onOpenEdit(task.id);
                      closeMenu();
                    }}
                  >
                    ערוך פרטים
                  </MenuBtn>

                  {display.urgency && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-ink-700">
                      <span className="text-xs text-ink-500 w-20">דחיפות</span>
                      <UrgencyChip
                        value={task.urgency}
                        onChange={(v) => {
                          if (task.urgency === v) return;
                          const prev = task.urgency;
                          updateTask.mutate({
                            taskId: task.id,
                            patch: { urgency: v },
                          });
                          pushUndo({
                            description: "שינוי דחיפות",
                            undo: () =>
                              updateTask.mutate({
                                taskId: task.id,
                                patch: { urgency: prev },
                              }),
                            redo: () =>
                              updateTask.mutate({
                                taskId: task.id,
                                patch: { urgency: v },
                              }),
                          });
                        }}
                      />
                    </div>
                  )}

                  {display.status && (() => {
                    const s = myStatuses.find((x) => x.key === task.status);
                    const color = s?.color ?? "#a8a8bc";
                    const label = s?.label ?? task.status;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenEdit(task.id);
                          closeMenu();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100 text-start"
                      >
                        <span className="text-xs text-ink-500 w-20">סטטוס</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span>{label}</span>
                      </button>
                    );
                  })()}

                  {display.subtasks && totalInSubtree > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-ink-700">
                      <span className="text-xs text-ink-500 w-20">תת-משימות</span>
                      <span className="font-mono tabular-nums">
                        {doneInSubtree}/{totalInSubtree}
                      </span>
                    </div>
                  )}

                  {display.dueDate && task.scheduled_at && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-ink-700">
                      <span className="text-xs text-ink-500 w-20">זמן עבודה</span>
                      <span>{formatShortDate(task.scheduled_at)}</span>
                    </div>
                  )}

                  {task.deadline_at && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-ink-700">
                      <span className="text-xs text-ink-500 w-20">דד-ליין</span>
                      <span>{formatShortDate(task.deadline_at)}</span>
                    </div>
                  )}

                  {display.estimated && task.estimated_hours != null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-ink-700">
                      <span className="text-xs text-ink-500 w-20">הוקצה</span>
                      <span>{formatHoursShort(task.estimated_hours)}</span>
                    </div>
                  )}

                  {display.link && task.external_url && (
                    <a
                      href={task.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100"
                    >
                      <span className="text-xs text-ink-500 w-20">קישור</span>
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span className="truncate text-xs" dir="ltr">
                        {task.external_url}
                      </span>
                    </a>
                  )}

                  {display.timer && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleTimer();
                        closeMenu();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100 text-start"
                    >
                      <span className="text-xs text-ink-500 w-20">סטופר</span>
                      {isActive ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {task.actual_seconds > 0 && (
                        <span className="text-xs font-mono tabular-nums text-ink-500">
                          {formatSeconds(task.actual_seconds, timeUnit)}
                        </span>
                      )}
                    </button>
                  )}

                  <div className="h-px bg-ink-100 my-1" />
                </div>

                <MenuBtn
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={handleDuplicateSingle}
                >
                  שכפל משימה
                </MenuBtn>
                <MenuBtn
                  icon={<CopyPlus className="w-3.5 h-3.5" />}
                  onClick={handleDuplicateTree}
                >
                  שכפל עץ
                </MenuBtn>
                <button
                  type="button"
                  onClick={() => setDuplicateToListOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100 text-start"
                >
                  <span className="inline-flex items-center gap-2">
                    <FolderInput className="w-3.5 h-3.5" />
                    שכפל לרשימה אחרת
                  </span>
                  <ChevronLeft className="w-3 h-3 text-ink-400" />
                </button>
                {duplicateToListOpen && (
                  <div className="max-h-52 overflow-y-auto border-t border-ink-100 mt-0.5">
                    <button
                      type="button"
                      onClick={() => handleDuplicateToList(null)}
                      className="w-full flex items-center gap-2 px-5 py-1.5 text-ink-700 hover:bg-ink-100 text-start text-[13px]"
                    >
                      לא משויכת
                    </button>
                    {taskLists.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handleDuplicateToList(l.id)}
                        className="w-full flex items-center gap-2 px-5 py-1.5 text-ink-700 hover:bg-ink-100 text-start text-[13px]"
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="h-px bg-ink-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setConfirmDelete(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-danger-600 hover:bg-danger/10 text-start"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  מחק משימה
                </button>
              </div>
            </>,
            document.body
          )}
        </div>}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] bg-ink-900/40 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-ink-900">מחיקת משימה</h3>
            <p className="text-sm text-ink-600">
              זה ימחק את "{task.title}" לצמיתות — וגם את כל תת-המשימות שלה אם יש.
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
                onClick={handleDelete}
                className="text-xs inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 font-medium bg-danger-500 text-white hover:bg-danger-600 transition-colors"
                type="button"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      {!collapsed && children.length > 0 && (
        <ChildrenBlock
          children={children}
          parentTaskId={task.id}
          grandparentTaskId={parentTaskId}
          listId={listId}
          onRequestFocus={onRequestFocus}
          focusTaskId={focusTaskId}
          onOpenEdit={onOpenEdit}
          display={display}
        />
      )}
    </>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function formatHoursShort(hours: number): string {
  if (hours >= 1) {
    const h = Number.isInteger(hours) ? hours : hours.toFixed(1);
    return `הוקצו ${h}ש`;
  }
  const m = Math.round(hours * 60);
  return `הוקצו ${m}ד`;
}

/**
 * Renders a list of child TaskRows with the completed ones tucked into a
 * collapsible "הושלמו N" strip at the bottom (per SPEC §15: completed subtasks
 * sink to bottom of their parent's children).
 */
function ChildrenBlock({
  children,
  parentTaskId,
  grandparentTaskId,
  listId,
  onRequestFocus,
  focusTaskId,
  onOpenEdit,
  display,
}: {
  children: TaskTreeNode[];
  parentTaskId: string | null;
  grandparentTaskId: string | null;
  listId: string | null;
  onRequestFocus: (taskId: string) => void;
  focusTaskId: string | null;
  onOpenEdit: (taskId: string) => void;
  display: RowDisplayPrefs;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const incomplete = children.filter((c) => !c.task.completed_at);
  const completed = children.filter((c) => !!c.task.completed_at);

  return (
    <div>
      {incomplete.map((child, idx) => (
        <TaskRow
          key={child.task.id}
          node={child}
          prevSiblingId={idx > 0 ? incomplete[idx - 1]!.task.id : null}
          parentTaskId={parentTaskId}
          grandparentTaskId={grandparentTaskId}
          listId={listId}
          onRequestFocus={onRequestFocus}
          focusTaskId={focusTaskId}
          onOpenEdit={onOpenEdit}
          display={display}
        />
      ))}
      {completed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 hover:text-ink-600 px-2 py-1"
            style={{ paddingInlineStart: completed[0]!.depth * 18 + 4 }}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={cn(
                "w-3 h-3 transition-transform",
                showCompleted ? "rotate-90" : "rotate-0"
              )}
            >
              <path d="M5 7l5 6 5-6H5z" />
            </svg>
            הושלמו ({completed.length})
          </button>
          {showCompleted &&
            completed.map((child) => (
              <TaskRow
                key={child.task.id}
                node={child}
                prevSiblingId={null}
                parentTaskId={parentTaskId}
                grandparentTaskId={grandparentTaskId}
                listId={listId}
                onRequestFocus={onRequestFocus}
                focusTaskId={focusTaskId}
                onOpenEdit={onOpenEdit}
                display={display}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/** Collapsed urgency chip: three short horizontal lines stacked vertically,
 *  filled bottom-up by value (1-3). Click to open a picker with 1-3 options.
 *  Legacy data values 4/5 are clamped to 3. */
function UrgencyChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = Math.min(3, Math.max(0, value));

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`דחיפות ${filled}/3`}
        title={`דחיפות ${filled}/3`}
        className="flex flex-col items-center justify-center gap-[2px] px-1 py-1 rounded-md hover:bg-ink-100"
      >
        {/* Top, middle, bottom — fill bottom-up. */}
        {[3, 2, 1].map((n) => (
          <span
            key={n}
            className={cn(
              "h-[2px] w-3 rounded-sm transition-colors",
              n <= filled ? "bg-ink-900" : "bg-ink-200"
            )}
          />
        ))}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-2 flex items-center gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChange(n);
                  setOpen(false);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-1 rounded-md hover:bg-ink-100",
                  n === filled && "bg-ink-100 ring-1 ring-ink-300"
                )}
                title={n === 0 ? "ללא דירוג" : `${n}/3`}
              >
                {n === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-[3px] h-[21px]">
                    <span className="text-ink-400 text-xs">∅</span>
                  </div>
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
  );
}

function countDescendants(children: TaskTreeNode[]): number {
  let n = 0;
  for (const c of children) {
    n += 1 + countDescendants(c.children);
  }
  return n;
}

function countCompletedDescendants(children: TaskTreeNode[]): number {
  let n = 0;
  for (const c of children) {
    if (c.task.completed_at) n += 1;
    n += countCompletedDescendants(c.children);
  }
  return n;
}

/** Flat list of every descendant id under `nodes`, depth-first. Used by the
 *  selection checkbox so toggling a parent cascades to its whole subtree. */
function collectDescendantIds(nodes: TaskTreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.task.id);
    if (n.children.length > 0) out.push(...collectDescendantIds(n.children));
  }
  return out;
}

function MenuBtn({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100 text-start"
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}
