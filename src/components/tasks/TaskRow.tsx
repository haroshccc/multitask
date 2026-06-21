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
  Move,
  Timer,
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
import { useHiddenProjectListIds } from "@/lib/hooks/useProjects";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/hooks/useTimer";
import { useTimeUnit, formatSeconds } from "@/lib/hooks/useTimeUnit";
import { useMyTaskStatuses } from "@/lib/hooks/useUserTaskStatuses";
import type { RowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
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
import { useFocusSession } from "@/components/focus/FocusSessionProvider";
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
  /**
   * Access level for this row.
   * "owner"  — full edit (default)
   * "write"  — description + timer only (no title edit, no completion, no DnD)
   * "read"   — view-only, no mutations
   */
  permission?: "owner" | "write" | "read";
  /** Sharing state of the goal, determines icon color. Omit for non-goal tasks. */
  goalShareKind?: "private" | "mine-read" | "mine-write" | "other-read" | "other-write";
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
  permission = "owner",
  goalShareKind,
}: TaskRowProps) {
  const { task, children, depth } = node;
  const { user } = useAuth();
  const taskOwnershipMode: "mine" | "delegated" | "assigned" =
    user && task.owner_id && task.owner_id !== user.id && task.assignee_user_id === user.id
      ? "assigned"
      : user && task.owner_id === user.id && task.assignee_user_id && task.assignee_user_id !== user.id
      ? "delegated"
      : "mine";
  const isAssigned = taskOwnershipMode === "assigned";
  const isReadOnly = permission === "read";
  const isWriteOnly = permission === "write";

  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const toggleOccurrence = useToggleOccurrence();
  const createTask = useCreateTask();
  const setParent = useSetTaskParent();
  const duplicateTree = useDuplicateTaskTree();
  const duplicateOne = useDuplicateTask();
  const deleteTaskM = useDeleteTask();
  const restoreTasks = useRestoreTasks();
  const { data: allTaskLists = [] } = useTaskLists();
  const hiddenProjectListIds = useHiddenProjectListIds();
  // Hide inactive/completed-project lists from the move/duplicate pickers.
  const taskLists = allTaskLists.filter((l) => !hiddenProjectListIds.has(l.id));
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: activeTimer } = useActiveTimer();
  const { startSession } = useFocusSession();

  // Assignee-name pill. Renders whenever the task has any assignee at
  // all — including self-assignment, since on a shared list it's useful
  // for everyone (including the assignee themselves) to see who is
  // responsible. useOrgMembers is cached per-org so the many-rows
  // pattern doesn't fan out into N queries.
  const { data: orgMembers = [] } = useOrgMembers();
  const assigneeUserId = task.assignee_user_id ?? null;
  const assigneeName = assigneeUserId
    ? orgMembers.find((m) => m.membership.user_id === assigneeUserId)
        ?.profile?.full_name ?? null
    : null;

  const [draft, setDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(() => stripDescHtml(task.description ?? ""));
  const [descFocused, setDescFocused] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  // Holds the latest commitDescription so the outside-click listener (whose
  // closure is pinned when the editor opens) always saves the current draft.
  const commitDescriptionRef = useRef<() => void>(() => {});
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    right?: number;
    left?: number;
  } | null>(null);
  const [duplicateToListOpen, setDuplicateToListOpen] = useState(false);
  const [moveToListOpen, setMoveToListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const el = menuTriggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
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
    setMoveToListOpen(false);
  };

  // Open the same actions menu from a right-click, positioned at the cursor.
  // Skip when the click lands on editable content (title / inputs / links) so
  // the native browser menu (copy/paste) still works while editing.
  const openMenuAt = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    const target = e.target as HTMLElement;
    if (target.closest('[contenteditable="true"], input, textarea, a')) return;
    e.preventDefault();
    const vw = window.innerWidth;
    const isRtl =
      typeof document !== "undefined" &&
      document.documentElement.dir === "rtl";
    if (isRtl) {
      setMenuPos({ top: e.clientY, right: Math.max(8, vw - e.clientX) });
    } else {
      setMenuPos({ top: e.clientY, left: Math.max(8, e.clientX) });
    }
    setMenuOpen(true);
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

  const totalInSubtree = countDescendants(children);
  const doneInSubtree = countCompletedDescendants(children);

  useEffect(() => {
    setDraft(task.title);
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.innerHTML = task.title ?? "";
    }
  }, [task.title]);

  useEffect(() => {
    if (!descFocused) setDescDraft(stripDescHtml(task.description ?? ""));
  }, [task.description, descFocused]);

  // Close the inline description (collapse back to the read-only preview)
  // when the user mouses down anywhere outside its textarea, or presses
  // Escape. The textarea's own onBlur already handles native focus moves,
  // but a click on a non-focusable element (e.g. another row's description
  // preview div) doesn't always shift focus in every browser — without
  // this listener two or more description editors stay open at once,
  // which is what users were hitting. Belt + braces: also wired to a
  // global Esc so a "stuck open" editor without focus can still be
  // dismissed.
  useEffect(() => {
    if (!descFocused) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = descRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      // Commit the *current* draft before tearing the editor down — using the
      // stale closure here would no-op (empty draft) and silently drop edits.
      commitDescriptionRef.current();
      setDescFocused(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDescDraft(stripDescHtml(task.description ?? ""));
        setDescFocused(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descFocused]);

  useEffect(() => {
    if (focusTaskId === task.id) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }, [focusTaskId, task.id]);

  // Returns a promise that resolves when the title save (if any) has
  // hit the server. Callers that immediately spawn a sibling/subtask
  // (Enter / Cmd+Enter) MUST await this so the new createTask's
  // invalidate-allTasks refetch reads the persisted title rather than
  // the pre-update server state — the latter clobbers the optimistic
  // patch and the row appears blank, which then trips the empty-title
  // sweep.
  const commitTitle = async (): Promise<void> => {
    const el = inputRef.current;
    const html = el
      ? (el.textContent ?? "").replace(/ /g, " ").trim()
      : draft.trim();
    if (!html) {
      // The input was empty when we committed. NEVER delete here — a
      // mid-keystroke optimistic refetch / focus shuffle can flush
      // the DOM read at exactly the wrong moment and yield html=""
      // for a row the user just typed into; deleting on that signal
      // is what users were seeing as "Enter ate my task". If the
      // DB title is non-empty, restore the displayed content from it
      // so the row stays consistent; otherwise just leave the row
      // alone. TaskColumn's cleanup effect (with its age guard) is
      // the single, authoritative path for removing genuinely
      // abandoned blank rows.
      if (task.title) {
        if (el) el.innerHTML = task.title;
        setDraft(task.title);
      } else if (draft !== "") {
        setDraft("");
      }
      return;
    }
    if (html === task.title) {
      setDraft(html);
      return;
    }
    const prevTitle = task.title;
    setDraft(html);
    await updateTask.mutateAsync({ taskId: task.id, patch: { title: html } });
    pushUndo({
      description: "שינוי כותרת",
      undo: () =>
        updateTask.mutate({ taskId: task.id, patch: { title: prevTitle } }),
      redo: () =>
        updateTask.mutate({ taskId: task.id, patch: { title: html } }),
    });
  };

  const commitDescription = () => {
    const trimmed = descDraft.trim();
    const current = stripDescHtml(task.description ?? "");
    if (trimmed === current) return;
    const prev = task.description;
    const htmlContent = convertDescToHtml(trimmed);
    updateTask.mutate({ taskId: task.id, patch: { description: htmlContent || null } });
    pushUndo({
      description: "עדכון פירוט",
      undo: () => updateTask.mutate({ taskId: task.id, patch: { description: prev } }),
      redo: () => updateTask.mutate({ taskId: task.id, patch: { description: htmlContent || null } }),
    });
  };
  commitDescriptionRef.current = commitDescription;

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.code === "Enter") {
      e.preventDefault();
      // Serialize: persist this row's title BEFORE spawning the subtask.
      // Otherwise the new createTask invalidates allTasks and its refetch
      // can read the server before our title PATCH lands, clobbering the
      // optimistic title with the prior (often empty) value — which then
      // looks to the user like the row vanished on Enter.
      await commitTitle();
      await handleAddSubtask();
      return;
    }

    if (mod && e.code === "KeyE") {
      e.preventDefault();
      onOpenEdit(task.id);
      return;
    }

    if (mod && e.code === "KeyD") {
      e.preventDefault();
      handleDuplicateSingle();
      return;
    }

    if (e.key === "Enter" && e.shiftKey && !mod) {
      e.preventDefault();
      await commitTitle();
      setDescFocused(true);
      setTimeout(() => descRef.current?.focus(), 0);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !mod) {
      e.preventDefault();
      // Same ordering rationale as the Cmd+Enter branch above — see
      // commitTitle's docstring.
      await commitTitle();
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
      if (!prevSiblingId) return;
      e.preventDefault();
      await commitTitle();
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
      if (!parentTaskId) return;
      e.preventDefault();
      await commitTitle();
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
      if (inputRef.current) inputRef.current.innerHTML = task.title ?? "";
      setDraft(task.title ?? "");
      inputRef.current?.blur();
    }
  };

  const [pendingComplete, setPendingComplete] = useState(false);
  const pendingTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    };
  }, []);

  const taskIsRecurring = isTaskRecurring(task);
  const now = new Date();
  const activeOccurrence = taskIsRecurring ? getActiveOccurrence(task, now) : null;
  const recurringSlotIsPast = !!activeOccurrence && activeOccurrence <= now;

  const showAsDone = taskIsRecurring
    ? pendingComplete || !recurringSlotIsPast
    : isDone || pendingComplete;

  const toggleComplete = () => {
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
      completeTask.mutate({ taskId: task.id, completed: false });
      pushUndo({
        description: "ביטול השלמה",
        undo: () => completeTask.mutate({ taskId: task.id, completed: true }),
        redo: () => completeTask.mutate({ taskId: task.id, completed: false }),
      });
      return;
    }
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

  const handleMoveToList = (targetListId: string | null) => {
    const prevListId = task.task_list_id ?? null;
    if (targetListId === prevListId) {
      closeMenu();
      return;
    }
    const apply = () =>
      updateTask.mutate({
        taskId: task.id,
        patch: { task_list_id: targetListId },
      });
    apply();
    pushUndo({
      description: "העברת משימה לרשימה",
      undo: () =>
        updateTask.mutate({
          taskId: task.id,
          patch: { task_list_id: prevListId },
        }),
      redo: apply,
    });
    closeMenu();
  };

  const handleDelete = async () => {
    const taskId = task.id;
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
        onContextMenu={openMenuAt}
        className={cn(
          "group relative flex items-start gap-1.5 rounded-md transition-colors px-1.5 py-1 hover:bg-ink-50",
          isDragging && "opacity-40",
          isOverNest && "bg-primary-50 ring-1 ring-primary-300",
          isSelected && "bg-primary-50/60 ring-1 ring-primary-300",
          taskIsRecurring && showAsDone && !isSelected && "opacity-60",
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

        {!isReadOnly && !isWriteOnly && (
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
        {(isReadOnly || isWriteOnly) && <span className="w-3.5 shrink-0" />}

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

        <button
          onClick={isReadOnly || isWriteOnly ? undefined : toggleComplete}
          disabled={isReadOnly || isWriteOnly}
          className={cn(
            "mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
            showAsDone
              ? "bg-success-500 border-success-500 text-white"
              : (isReadOnly || isWriteOnly)
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

        {isPhase && (
          <span
            className="shrink-0 self-center inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: "var(--list-color, #6b6b80)" }}
            title="שלב — פריט שמקבץ תחתיו תתי-משימות"
          >
            שלב
          </span>
        )}

        {/* Title + description column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative">
            <div
              ref={inputRef}
              contentEditable={isReadOnly || isWriteOnly || isAssigned ? undefined : "true"}
              suppressContentEditableWarning
              onFocus={() => setTitleFocused(true)}
              onBlur={
                isReadOnly || isWriteOnly || isAssigned
                  ? undefined
                  : () => { setTitleFocused(false); commitTitle(); }
              }
              onKeyDown={isReadOnly || isWriteOnly || isAssigned ? undefined : handleKeyDown}
              onDoubleClick={isReadOnly ? undefined : () => onOpenEdit(task.id)}
              data-placeholder="משימה חדשה..."
              className={cn(
                "w-full bg-transparent border-0 outline-none text-sm py-0.5 break-words min-h-[1.25rem]",
                "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-ink-300 [&:empty]:before:pointer-events-none",
                (isReadOnly || isWriteOnly || isAssigned) && "cursor-default select-text",
                !taskIsRecurring && showAsDone && "line-through text-ink-400"
              )}
            />
            {titleFocused && !isReadOnly && !isWriteOnly && !isAssigned && (
              <RichTextTitleBar targetRef={inputRef} />
            )}
          </div>
          {/* Inline description — only shown when there is content or when focused */}
          {(!!task.description || descFocused) && (
            descFocused ? (
              <textarea
                ref={descRef}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={() => {
                  setDescFocused(false);
                  commitDescription();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDescDraft(stripDescHtml(task.description ?? ""));
                    setDescFocused(false);
                    inputRef.current?.focus();
                  }
                }}
                placeholder="פירוט..."
                rows={7}
                className="w-full bg-transparent border-0 outline-none text-xs text-ink-500 py-0.5 resize-y leading-relaxed"
              />
            ) : (
              <div
                className="text-xs text-ink-400 leading-relaxed line-clamp-2 py-0.5 cursor-text [&_*]:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: task.description ?? "" }}
                onClick={() => {
                  if (!isReadOnly && !isWriteOnly && !isAssigned) {
                    setDescDraft(stripDescHtml(task.description ?? ""));
                    setDescFocused(true);
                  }
                }}
              />
            )
          )}
        </div>

        {display.assignee && assigneeName && (
          <span
            className="shrink-0 text-[10px] text-ink-600 font-medium leading-none px-1.5 py-0.5 rounded-full bg-ink-100"
            title={`אחראי: ${assigneeName}`}
          >
            {assigneeName}
          </span>
        )}
        {task.status === "pending_approval" && (
          <HalfCheckIcon
            size={14}
            onApprove={
              user && task.approver_user_id === user.id
                ? (e) => {
                    e.stopPropagation();
                    const prevPatch = {
                      status: task.status,
                      approved_at: task.approved_at,
                      completed_at: task.completed_at,
                    };
                    const nextPatch = {
                      status: "done",
                      approved_at: new Date().toISOString(),
                      completed_at: new Date().toISOString(),
                    };
                    updateTask.mutate({
                      taskId: task.id,
                      patch: nextPatch,
                    });
                    pushUndo({
                      description: "אישור משימה",
                      undo: () =>
                        updateTask.mutate({
                          taskId: task.id,
                          patch: prevPatch,
                        }),
                      redo: () =>
                        updateTask.mutate({
                          taskId: task.id,
                          patch: nextPatch,
                        }),
                    });
                  }
                : undefined
            }
          />
        )}

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

        {(task.goal_period || (task as any).goal_type === "achievement") && (
          <span
            className={cn("shrink-0 inline-flex", showAsDone && "opacity-60")}
            title={
              (task as any).goal_type === "achievement"
                ? "יעד הישגי"
                : task.goal_period === "day"
                  ? `יעד: ${task.goal_target ?? 1} פעמים ביום`
                  : task.goal_period === "week"
                    ? `יעד: ${task.goal_target ?? 1} פעמים בשבוע`
                    : `יעד: ${task.goal_target ?? 1} פעמים בחודש`
            }
          >
            <Target
              className={cn(
                "w-4 h-4",
                (goalShareKind === "other-read" || goalShareKind === "other-write")
                  ? "text-blue-500"
                  : (goalShareKind === "mine-read" || goalShareKind === "mine-write")
                    ? "text-pink-500"
                    : "text-amber-500"
              )}
            />
          </span>
        )}

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

        {!isReadOnly && display.timer && (
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

        {!isReadOnly && display.timer && task.actual_seconds > 0 && (
          <button
            type="button"
            onClick={() => onOpenEdit(task.id)}
            className="shrink-0 text-[11px] font-mono tabular-nums text-ink-500 hover:text-primary-700 px-1 rounded-md"
            title="עריכת סשנים ויחידת מידה"
          >
            {formatSeconds(task.actual_seconds, timeUnit)}
          </button>
        )}

        {!isReadOnly && !isWriteOnly && !isAssigned && (
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

        {!isReadOnly && !isWriteOnly && !isAssigned && (
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
        {isWriteOnly && (
          <button
            onClick={() => onOpenEdit(task.id)}
            className="shrink-0 p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="ערוך תיאור"
            title="ערוך תיאור"
            type="button"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        </div>

        {!isReadOnly && <div className="relative shrink-0">
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
                {!isPhase && (
                  <>
                    <MenuBtn
                      icon={<Timer className="w-3.5 h-3.5" />}
                      onClick={() => { startSession(task); closeMenu(); }}
                    >
                      התחל לעבוד עכשיו
                    </MenuBtn>
                    <div className="h-px bg-ink-100 my-1" />
                  </>
                )}
                {(isAssigned || isWriteOnly) ? (
                  <div className="md:hidden">
                    <MenuBtn
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={() => { onOpenEdit(task.id); closeMenu(); }}
                    >
                      צפה בפרטים
                    </MenuBtn>
                    {display.timer && (
                      <button
                        type="button"
                        onClick={() => { toggleTimer(); closeMenu(); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100 text-start"
                      >
                        <span className="text-xs text-ink-500 w-20">סטופר</span>
                        {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {task.actual_seconds > 0 && (
                          <span className="text-xs font-mono tabular-nums text-ink-500">
                            {formatSeconds(task.actual_seconds, timeUnit)}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
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
                )} {/* end isAssigned ternary */}

                {!isAssigned && !isWriteOnly && <><MenuBtn
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
                <button
                  type="button"
                  onClick={() => setMoveToListOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-ink-700 hover:bg-ink-100 text-start"
                >
                  <span className="inline-flex items-center gap-2">
                    <Move className="w-3.5 h-3.5" />
                    העבר לרשימה
                  </span>
                  <ChevronLeft className="w-3 h-3 text-ink-400" />
                </button>
                {moveToListOpen && (
                  <div className="max-h-52 overflow-y-auto border-t border-ink-100 mt-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveToList(null)}
                      className={cn(
                        "w-full flex items-center gap-2 px-5 py-1.5 hover:bg-ink-100 text-start text-[13px]",
                        (task.task_list_id ?? null) === null
                          ? "text-ink-900 font-medium"
                          : "text-ink-700"
                      )}
                    >
                      לא משויכת
                    </button>
                    {taskLists.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handleMoveToList(l.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-5 py-1.5 hover:bg-ink-100 text-start text-[13px]",
                          l.id === task.task_list_id
                            ? "text-ink-900 font-medium"
                            : "text-ink-700"
                        )}
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
                </>} {/* end !isAssigned */}
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
          permission={permission}
          goalShareKind={goalShareKind}
        />
      )}
    </>
  );
}

function stripDescHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const lines: string[] = [];
  const visit = (node: Node, listType: "ol" | "ul" | null, cnt: { n: number }) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? "").trim();
      if (t) lines.push(t);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "ul") {
        el.childNodes.forEach((c) => visit(c, "ul", cnt));
      } else if (tag === "ol") {
        const c2 = { n: 1 };
        el.childNodes.forEach((c) => visit(c, "ol", c2));
      } else if (tag === "li") {
        const text = (el.textContent ?? "").trim();
        lines.push(listType === "ol" ? `${cnt.n++}. ${text}` : `• ${text}`);
      } else if (tag === "br") {
        lines.push("");
      } else if (tag === "p" || tag === "div") {
        el.childNodes.forEach((c) => visit(c, listType, cnt));
        lines.push("");
      } else {
        el.childNodes.forEach((c) => visit(c, listType, cnt));
      }
    }
  };
  tmp.childNodes.forEach((n) => visit(n, null, { n: 1 }));
  return lines
    .filter((l, i) => l !== "" || (i > 0 && lines[i - 1] !== ""))
    .join("\n")
    .trim();
}

function convertDescToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const parts: string[] = [];
  let listType: "ol" | "ul" | null = null;
  const closeList = () => {
    if (listType) { parts.push(`</${listType}>`); listType = null; }
  };
  for (const line of lines) {
    const ordM = line.match(/^(\d+)\.\s+(.*)$/);
    const bulM = line.match(/^•\s+(.*)$/);
    const dasM = line.match(/^[—\-]\s+(.*)$/);
    if (ordM) {
      if (listType !== "ol") { closeList(); parts.push("<ol>"); listType = "ol"; }
      parts.push(`<li>${ordM[2]}</li>`);
    } else if (bulM) {
      if (listType !== "ul") { closeList(); parts.push("<ul>"); listType = "ul"; }
      parts.push(`<li>${bulM[1]}</li>`);
    } else if (dasM) {
      if (listType !== "ul") { closeList(); parts.push("<ul>"); listType = "ul"; }
      parts.push(`<li>${dasM[1]}</li>`);
    } else {
      closeList();
      if (line.trim()) parts.push(`<p>${line}</p>`);
    }
  }
  closeList();
  return parts.join("");
}

const TITLE_FORMAT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#1f2937",
];

function RichTextTitleBar({ targetRef }: { targetRef: { current: HTMLDivElement | null } }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setPos(null); return; }
      const range = sel.getRangeAt(0);
      const target = targetRef.current;
      if (!target || !target.contains(range.commonAncestorContainer)) { setPos(null); return; }
      const rect = range.getBoundingClientRect();
      setPos({ top: rect.top + window.scrollY - 42, left: rect.left + window.scrollX + rect.width / 2 });
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [targetRef]);

  useEffect(() => {
    if (!colorOpen) return;
    const handle = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setColorOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [colorOpen]);

  if (!pos) return null;

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    targetRef.current?.focus();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand("insertText", false, text);
    } catch {
      document.execCommand("paste");
    }
  };

  return createPortal(
    <div
      ref={barRef}
      className="fixed z-50 -translate-x-1/2 flex items-center gap-0.5 bg-ink-900 text-white rounded-lg px-1.5 py-1 shadow-xl"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-ink-700 font-bold text-xs">B</button>
      <button type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-ink-700 italic text-xs">I</button>
      <button type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-ink-700 underline text-xs">U</button>
      <div className="w-px h-4 bg-ink-600 mx-0.5" />
      <div className="relative">
        <button type="button"
          onMouseDown={(e) => { e.preventDefault(); setColorOpen((v) => !v); }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-ink-700 text-xs font-bold"
          style={{ color: "#f59e0b" }}>A</button>
        {colorOpen && (
          <div className="absolute bottom-full mb-1 start-0 grid grid-cols-4 gap-1 bg-white border border-ink-200 rounded-lg shadow-lg p-1.5">
            {TITLE_FORMAT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c); setColorOpen(false); }}
                className="w-5 h-5 rounded-full border border-ink-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-ink-600 mx-0.5" />
      <button type="button"
        onMouseDown={(e) => { e.preventDefault(); exec("copy"); }}
        title="העתק"
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-ink-700 text-[10px]">⎘</button>
      <button type="button"
        onMouseDown={(e) => { e.preventDefault(); void handlePaste(); }}
        title="הדבק"
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-ink-700 text-[10px]">📋</button>
    </div>,
    document.body
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

function ChildrenBlock({
  children,
  parentTaskId,
  grandparentTaskId,
  listId,
  onRequestFocus,
  focusTaskId,
  onOpenEdit,
  display,
  permission,
  goalShareKind,
}: {
  children: TaskTreeNode[];
  parentTaskId: string | null;
  grandparentTaskId: string | null;
  listId: string | null;
  onRequestFocus: (taskId: string) => void;
  focusTaskId: string | null;
  onOpenEdit: (taskId: string) => void;
  display: RowDisplayPrefs;
  permission?: "owner" | "write" | "read";
  goalShareKind?: "private" | "mine-read" | "mine-write" | "other-read" | "other-write";
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
          permission={permission}
          goalShareKind={goalShareKind}
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
                permission={permission}
                goalShareKind={goalShareKind}
              />
            ))}
        </div>
      )}
    </div>
  );
}

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
