import { useEffect, useState } from "react";
import { Loader2, Play, Square } from "lucide-react";
import type { Task } from "@/lib/types/domain";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/queries/timer";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils/cn";

interface Props {
  task: Task;
  variant?: "default" | "compact";
  onClick?: (e: React.MouseEvent) => void;
}

export function TaskTimerButton({ task, variant = "default", onClick }: Props) {
  const { user } = useAuth();
  const active = useActiveTimer(user?.id ?? null);
  const start = useStartTimer();
  const stop = useStopTimer();

  const isActiveForThis = active.data?.task_id === task.id;
  const isActiveForOther = active.data && !isActiveForThis;
  const pending = start.isPending || stop.isPending;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
    if (pending) return;
    if (isActiveForThis) {
      await stop.mutateAsync();
    } else {
      if (isActiveForOther) {
        const other = active.data!;
        if (
          !confirm(
            `סטופר אחר רץ כבר (התחיל ב-${new Date(other.started_at).toLocaleTimeString(
              "he-IL"
            )}). לעצור אותו ולהתחיל את זה?`
          )
        )
          return;
      }
      await start.mutateAsync(task.id);
    }
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        disabled={pending}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          isActiveForThis
            ? "bg-danger-500 text-white hover:bg-danger-600"
            : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
        )}
        title={isActiveForThis ? "עצרי סטופר" : "התחילי סטופר"}
        aria-label={isActiveForThis ? "עצרי סטופר" : "התחילי סטופר"}
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isActiveForThis ? (
          <Square className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={pending}
        className={cn(
          "btn",
          isActiveForThis ? "bg-danger-500 text-white hover:bg-danger-600" : "btn-outline"
        )}
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isActiveForThis ? (
          <Square className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {isActiveForThis ? "עצרי סטופר" : "התחילי סטופר"}
      </button>
      {isActiveForThis && <ActiveTimerCounter startedAt={active.data!.started_at} />}
    </div>
  );
}

function ActiveTimerCounter({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return (
    <div className="font-mono text-sm text-ink-700 tabular-nums">
      {formatElapsed(elapsed)}
    </div>
  );
}

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}
