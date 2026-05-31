import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarX, Clock, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Task } from "@/lib/types/domain";
import {
  useDeleteTask,
  useDuplicateTask,
  useRestoreTasks,
  useUpdateTask,
} from "@/lib/hooks";
import { fetchTaskSubtree } from "@/lib/services/tasks";
import { pushUndo } from "@/lib/undo/store";
import { DurationInput } from "@/components/ui/DurationInput";

/**
 * Right-click actions for a task — shared by the scheduling panel and the
 * calendar grid. Renders as a fixed-position portal at the cursor with:
 * unschedule, duplicate, edit duration (inline), delete. All mutations push
 * an undo entry.
 */
export function TaskActionsMenu({
  task,
  x,
  y,
  onClose,
}: {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const updateTask = useUpdateTask();
  const duplicate = useDuplicateTask();
  const deleteTask = useDeleteTask();
  const restore = useRestoreTasks();

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [durationMode, setDurationMode] = useState(false);
  const [durationMin, setDurationMin] = useState<number | null>(
    task.duration_minutes ?? null
  );

  // Keep the menu fully on-screen; anchor its right edge near the cursor (RTL).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = x - r.width;
    let top = y;
    if (left < 8) left = 8;
    if (left + r.width > window.innerWidth - 8)
      left = window.innerWidth - 8 - r.width;
    if (top + r.height > window.innerHeight - 8)
      top = Math.max(8, window.innerHeight - 8 - r.height);
    setPos({ left, top });
  }, [x, y, durationMode]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const unschedule = () => {
    const prev = task.scheduled_at;
    const patch = { scheduled_at: null };
    updateTask.mutate({ taskId: task.id, patch });
    pushUndo({
      description: "ביטול שיבוץ",
      undo: () =>
        updateTask.mutate({ taskId: task.id, patch: { scheduled_at: prev } }),
      redo: () => updateTask.mutate({ taskId: task.id, patch }),
    });
    onClose();
  };

  const dup = () => {
    duplicate.mutate({ sourceTaskId: task.id });
    onClose();
  };

  const saveDuration = () => {
    const prev = task.duration_minutes ?? null;
    const patch = { duration_minutes: durationMin };
    updateTask.mutate({ taskId: task.id, patch });
    pushUndo({
      description: "עריכת משך",
      undo: () =>
        updateTask.mutate({
          taskId: task.id,
          patch: { duration_minutes: prev },
        }),
      redo: () => updateTask.mutate({ taskId: task.id, patch }),
    });
    onClose();
  };

  const del = async () => {
    let subtree: Task[] = [];
    try {
      subtree = await fetchTaskSubtree(task.id);
    } catch (err) {
      console.error("delete: failed to snapshot subtree", err);
    }
    deleteTask.mutate(task.id);
    if (subtree.length > 0) {
      pushUndo({
        description:
          subtree.length > 1
            ? `מחיקת משימה (${subtree.length} פריטים)`
            : "מחיקת משימה",
        undo: () => restore.mutate(subtree),
        redo: () => deleteTask.mutate(task.id),
      });
    }
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 9999 }}
      className="card shadow-lift py-1 min-w-[190px] text-sm"
      onContextMenu={(e) => e.preventDefault()}
    >
      {durationMode ? (
        <div className="px-3 py-2 space-y-2 w-56">
          <div className="text-xs text-ink-500">עריכת משך</div>
          <DurationInput
            value={durationMin}
            onChange={setDurationMin}
            placeholder="00:00"
            ariaLabel="משך"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              ביטול
            </button>
            <button
              type="button"
              onClick={saveDuration}
              className="btn-primary text-xs"
            >
              שמירה
            </button>
          </div>
        </div>
      ) : (
        <>
          <MenuItem
            icon={CalendarX}
            label="ביטול שיבוץ ביומן"
            onClick={unschedule}
            disabled={!task.scheduled_at}
          />
          <MenuItem icon={Copy} label="שכפול" onClick={dup} />
          <MenuItem
            icon={Clock}
            label="עריכת משך"
            onClick={() => setDurationMode(true)}
          />
          <MenuItem icon={Trash2} label="מחיקה" onClick={del} danger />
        </>
      )}
    </div>,
    document.body
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-start hover:bg-ink-100",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
        danger ? "text-danger-600" : "text-ink-700"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
