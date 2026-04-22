import { useEffect, useState } from "react";
import { Loader2, Square } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useActiveTimer, useStopTimer } from "@/lib/queries/timer";
import { useTask } from "@/lib/queries/tasks";

export function ActiveTimerPill() {
  const { user } = useAuth();
  const active = useActiveTimer(user?.id ?? null);
  const task = useTask(active.data?.task_id ?? null);
  const stop = useStopTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active.data) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active.data]);

  if (!active.data) return null;

  const elapsed = Math.max(
    0,
    Math.floor((now - new Date(active.data.started_at).getTime()) / 1000)
  );

  return (
    <div className="fixed bottom-20 md:bottom-4 start-4 z-20 bg-ink-900 text-white rounded-full shadow-lift pe-1 ps-3 py-1 flex items-center gap-2 max-w-[min(320px,80vw)]">
      <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse shrink-0" />
      <div className="text-xs truncate flex-1 min-w-0">
        {task.data?.title ?? "סטופר פעיל"}
      </div>
      <div className="font-mono text-xs tabular-nums shrink-0">
        {formatElapsed(elapsed)}
      </div>
      <button
        onClick={() => stop.mutate()}
        disabled={stop.isPending}
        className="p-1.5 rounded-full bg-danger-500 hover:bg-danger-600 shrink-0"
        aria-label="עצרי סטופר"
      >
        {stop.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>
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
