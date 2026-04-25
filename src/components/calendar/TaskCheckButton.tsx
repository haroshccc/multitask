import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCompleteTask } from "@/lib/hooks/useTasks";

interface TaskCheckButtonProps {
  taskId: string;
  completed: boolean;
  /** Visual size — `sm` for chips/blocks (12-14px), `md` for agenda rows (16px). */
  size?: "sm" | "md";
  /** Tint of the unchecked outline + the filled box when checked. Defaults
   *  to a neutral ink-300 outline + success-500 fill. Pass an accent (e.g.
   *  the list color) to keep the box on-brand for that list. */
  accent?: string | null;
  className?: string;
}

/**
 * The little circle/box on each task block in the calendar that toggles
 * `completed_at`. Always stops propagation so clicking the box never
 * opens the surrounding edit modal.
 */
export function TaskCheckButton({
  taskId,
  completed,
  size = "sm",
  accent,
  className,
}: TaskCheckButtonProps) {
  const completeTask = useCompleteTask();
  const sizeClass =
    size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const checkSize =
    size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";

  // Outline style — when unchecked, use the accent color at low opacity
  // so the box reads as part of the surrounding block. When checked,
  // fill with success green.
  const borderColor = completed ? "#22c55e" : accent ?? "#a8a8bc";
  const bgColor = completed ? "#22c55e" : "transparent";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        completeTask.mutate({ taskId, completed: !completed });
      }}
      className={cn(
        "rounded-sm shrink-0 flex items-center justify-center transition-all border-2",
        sizeClass,
        className
      )}
      style={{ borderColor, backgroundColor: bgColor }}
      aria-label={completed ? "סמן כלא הושלם" : "סמן כהושלם"}
      title={completed ? "סמן כלא הושלם" : "סמן כהושלם"}
      type="button"
    >
      {completed && (
        <Check className={cn(checkSize, "text-white")} strokeWidth={3} />
      )}
    </button>
  );
}
