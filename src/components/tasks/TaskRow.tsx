import { useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Play,
  Pause,
  Star,
  MoreHorizontal,
  Copy,
  Pencil,
  GripVertical,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCompleteTask,
  useUpdateTask,
  useCreateTask,
  useSetTaskParent,
  useDuplicateTaskTree,
} from "@/lib/hooks/useTasks";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/hooks/useTimer";
import { useTimeUnit, formatSeconds } from "@/lib/hooks/useTimeUnit";
import type { RowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { Link as LinkIcon, Calendar as CalendarIcon } from "lucide-react";
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
}: TaskRowProps) {
  const { task, children, depth } = node;

  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const createTask = useCreateTask();
  const setParent = useSetTaskParent();
  const duplicate = useDuplicateTaskTree();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: activeTimer } = useActiveTimer();

  const [draft, setDraft] = useState(task.title);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [timeUnit] = useTimeUnit();

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
    updateTask.mutate({ taskId: task.id, patch: { title: trimmed } });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitTitle();
      // Create new sibling right after this one.
      const newTask = await createTask.mutateAsync({
        title: "",
        task_list_id: listId ?? null,
        parent_task_id: parentTaskId,
        status: "todo",
        urgency: 3,
      });
      onRequestFocus(newTask.id);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      // Indent: make this a child of previous sibling.
      if (!prevSiblingId) return;
      e.preventDefault();
      commitTitle();
      setParent.mutate({ taskId: task.id, parentId: prevSiblingId });
      return;
    }
    if (e.key === "Tab" && e.shiftKey) {
      // Outdent: promote one level. Only possible if this is a child.
      if (!parentTaskId) return;
      e.preventDefault();
      commitTitle();
      setParent.mutate({ taskId: task.id, parentId: grandparentTaskId });
      return;
    }
    if (e.key === "Escape") {
      setDraft(task.title);
      inputRef.current?.blur();
    }
  };

  const toggleComplete = () => {
    completeTask.mutate({ taskId: task.id, completed: !isDone });
  };

  const toggleTimer = () => {
    if (isActive) stopTimer.mutate();
    else startTimer.mutate({ taskId: task.id });
  };

  const handleDuplicate = () => {
    duplicate.mutate({ sourceTaskId: task.id });
    setMenuOpen(false);
  };

  const handleAddSubtask = async () => {
    const newTask = await createTask.mutateAsync({
      title: "",
      task_list_id: listId ?? null,
      parent_task_id: task.id,
      status: "todo",
      urgency: 3,
    });
    setCollapsed(false);
    onRequestFocus(newTask.id);
  };

  // DnD — the row is both a drag source AND a drop target
  // (dropping a task onto a row makes it a child of that row).
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `task:${task.id}`,
    data: { type: "task", taskId: task.id, listId, parentTaskId },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `task-drop:${task.id}`,
    data: { type: "task-drop", taskId: task.id, listId },
  });

  // Combine refs
  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <>
      <div
        ref={setRef}
        className={cn(
          "group flex items-start gap-1.5 rounded-md transition-colors px-1.5 py-1",
          isDragging && "opacity-40",
          isOver && "bg-primary-50 ring-1 ring-primary-300"
        )}
        style={{ paddingInlineStart: depth * 18 + 4 }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-ink-400 hover:text-ink-700 pt-1 shrink-0"
          aria-label="גרור"
          type="button"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

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

        {/* Checkbox — fill + border take the list's color if set, otherwise success */}
        <button
          onClick={toggleComplete}
          className={cn(
            "mt-0.5 w-4 h-4 rounded-sm border-2 shrink-0 flex items-center justify-center transition-all",
            isDone
              ? "text-white border-transparent"
              : "border-ink-300 hover:border-ink-500"
          )}
          style={
            isDone
              ? {
                  backgroundColor: "var(--list-color, #10b981)",
                  borderColor: "var(--list-color, #10b981)",
                }
              : undefined
          }
          aria-label={isDone ? "בטל סימון" : "סמן כהושלמה"}
          type="button"
        >
          {isDone && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Title input */}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => onOpenEdit(task.id)}
          placeholder="משימה חדשה..."
          className={cn(
            "flex-1 min-w-0 bg-transparent border-0 outline-none text-sm py-0.5",
            isDone && "line-through text-ink-400"
          )}
        />

        {display.urgency && (
          <UrgencyChip
            value={task.urgency}
            onChange={(v) =>
              updateTask.mutate({ taskId: task.id, patch: { urgency: v } })
            }
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

        {display.dueDate && task.scheduled_at && (
          <span
            className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100"
            title="תאריך יעד"
          >
            <CalendarIcon className="w-3 h-3" />
            {formatShortDate(task.scheduled_at)}
          </span>
        )}

        {display.estimated && task.estimated_hours != null && (
          <span
            className="shrink-0 text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100"
            title="זמן שהוקצה"
          >
            {formatHoursShort(task.estimated_hours)}
          </span>
        )}

        {display.estimatedVsActual && task.estimated_hours != null && (
          <ProgressVsEstimate
            actualSeconds={task.actual_seconds}
            estimatedHours={task.estimated_hours}
          />
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

        {/* + subtask — visible on row hover */}
        <button
          onClick={handleAddSubtask}
          className="shrink-0 p-1 rounded-md text-ink-400 hover:text-primary-700 hover:bg-primary-50 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="הוסף תת-משימה"
          title="הוסף תת-משימה"
          type="button"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>

        {/* Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100 opacity-0 group-hover:opacity-100"
            aria-label="תפריט"
            type="button"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute end-0 mt-1 w-48 bg-white border border-ink-200 rounded-xl shadow-lift z-20 py-1 text-sm">
                <MenuBtn
                  icon={<CornerDownLeft className="w-3.5 h-3.5" />}
                  onClick={() => {
                    handleAddSubtask();
                    setMenuOpen(false);
                  }}
                >
                  הוסף תת-משימה
                </MenuBtn>
                <MenuBtn
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onOpenEdit(task.id);
                    setMenuOpen(false);
                  }}
                >
                  ערוך פרטים
                </MenuBtn>
                <MenuBtn
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={handleDuplicate}
                >
                  שכפל תת-עץ
                </MenuBtn>
              </div>
            </>
          )}
        </div>
      </div>

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

function ProgressVsEstimate({
  actualSeconds,
  estimatedHours,
}: {
  actualSeconds: number;
  estimatedHours: number;
}) {
  const estimatedSeconds = estimatedHours * 3600;
  if (estimatedSeconds <= 0) return null;
  const ratio = actualSeconds / estimatedSeconds;
  const pct = Math.round(ratio * 100);
  const over = ratio > 1;
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md",
        over
          ? "bg-danger/10 text-danger-600"
          : ratio > 0.8
          ? "bg-warning/10 text-warning-600"
          : "bg-success/10 text-success-600"
      )}
      title={`בפועל ${pct}% מהזמן שהוקצה`}
    >
      {pct}%
    </span>
  );
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

/** Collapsed urgency chip: single star with number inside. Click to expand. */
function UrgencyChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const tinted = value > 0;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="דחיפות"
        className="relative flex items-center justify-center w-5 h-5 rounded-md hover:bg-ink-100"
        style={
          tinted ? { color: "var(--list-color, #f59e0b)" } : { color: "#a8a8bc" }
        }
      >
        <Star
          className={cn("w-4 h-4", tinted && "fill-current")}
        />
        {tinted && (
          <span
            className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white tabular-nums"
            aria-hidden
          >
            {value}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-1.5 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChange(n === value ? 0 : n);
                  setOpen(false);
                }}
                className="p-0.5 text-ink-300 hover:scale-110 transition-transform"
                style={
                  n <= value
                    ? { color: "var(--list-color, #f59e0b)" }
                    : undefined
                }
              >
                <Star
                  className={cn("w-4 h-4", n <= value && "fill-current")}
                />
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
