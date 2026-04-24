import { CheckSquare, Calendar as CalendarIcon, Layers } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { LayerMode } from "./calendar-utils";

interface TasksEventsToggleProps {
  value: LayerMode;
  onChange: (v: LayerMode) => void;
  className?: string;
}

/**
 * 3-state toggle — tasks / events / both.
 * Used in Lists Banner `extra` slot on both Calendar and Gantt screens.
 */
export function TasksEventsToggle({ value, onChange, className }: TasksEventsToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-ink-200 p-0.5 bg-white text-xs",
        className
      )}
      role="group"
      aria-label="סוגי רשומות"
    >
      <Btn
        active={value === "both"}
        onClick={() => onChange("both")}
        label="שניהם"
        icon={<Layers className="w-3.5 h-3.5" />}
      />
      <Btn
        active={value === "tasks"}
        onClick={() => onChange("tasks")}
        label="משימות"
        icon={<CheckSquare className="w-3.5 h-3.5" />}
      />
      <Btn
        active={value === "events"}
        onClick={() => onChange("events")}
        label="אירועים"
        icon={<CalendarIcon className="w-3.5 h-3.5" />}
      />
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-sm font-medium transition-colors",
        active
          ? "bg-ink-900 text-white"
          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
      )}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
