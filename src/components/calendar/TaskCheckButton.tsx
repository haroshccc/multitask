import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCompleteTask } from "@/lib/hooks/useTasks";

interface TaskCheckButtonProps {
  taskId: string;
  completed: boolean;
  /** Visual size — `sm` for chips/blocks, `md` for agenda rows. */
  size?: "sm" | "md";
  /** Tint of the unchecked outline + the filled box when checked. Defaults
   *  to a neutral ink-300 outline + success-500 fill. Pass an accent (e.g.
   *  the list color) to keep the box on-brand for that list. */
  accent?: string | null;
  className?: string;
}

/**
 * The little box on each task block in the calendar that toggles
 * `completed_at`. Stops propagation so clicking the box never opens
 * the surrounding edit modal. Visual is delicate by design — the box
 * is small with a 1-px border and a slightly-rounded square so it
 * reads as metadata, not as a primary affordance.
 */
export function TaskCheckButton({
  taskId,
  completed,
  size = "sm",
  accent,
  className,
}: TaskCheckButtonProps) {
  const completeTask = useCompleteTask();
  const sizeClass = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const checkSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  // Unchecked: hairline outline in the accent color (or a neutral grey).
  // Checked: filled with success green so the V reads strongly even at
  // 12px. Border stays at 1px throughout to keep the chip delicate.
  const borderColor = completed ? "#16a34a" : accent ?? "#a8a8bc";
  const bgColor = completed ? "#16a34a" : "transparent";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        completeTask.mutate({ taskId, completed: !completed });
      }}
      className={cn(
        "shrink-0 inline-flex items-center justify-center transition-colors",
        // 3px = subtle radius — square-ish but not perfectly sharp.
        "rounded-[3px] border",
        sizeClass,
        className
      )}
      style={{ borderColor, backgroundColor: bgColor }}
      aria-label={completed ? "סמן כלא הושלם" : "סמן כהושלם"}
      title={completed ? "סמן כלא הושלם" : "סמן כהושלם"}
      type="button"
    >
      {completed && (
        <Check
          className={cn(checkSize, "text-white")}
          // 2.5 = slim ✓ that still reads at 8-10px. The previous 3
          // produced a heavy-marker look the user flagged as "massive".
          strokeWidth={2.5}
        />
      )}
    </button>
  );
}
