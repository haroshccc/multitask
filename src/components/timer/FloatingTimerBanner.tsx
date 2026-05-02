import { useEffect, useRef, useState } from "react";
import { Play, Pause, X, Clock, GripVertical } from "lucide-react";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/hooks/useTimer";
import { useTask } from "@/lib/hooks/useTasks";
import { useTaskList } from "@/lib/hooks/useTaskLists";
import { cn } from "@/lib/utils/cn";

const POS_KEY = "multitask.timer-banner.pos";
const MARGIN = 8;

interface Pos {
  x: number;
  y: number;
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Global floating banner for the active task timer. Mounted once at the
 * AppShell so it persists across screen navigation.
 *
 * Lifecycle:
 * - When a timer becomes active → banner appears, sticks to that task.
 * - When the timer is stopped → banner stays visible with the same task and
 *   a play button to resume; the running counter freezes at 00:00.
 * - X dismisses the banner without affecting the timer state. A new
 *   `start_timer` call (from anywhere) un-dismisses it.
 *
 * Drag: pointer-down anywhere on the card (except a button) starts a drag.
 * Position persists in localStorage; viewport-clamped on each move and on
 * window resize.
 */
export function FloatingTimerBanner() {
  const { data: activeEntry } = useActiveTimer();
  const [stickyTaskId, setStickyTaskId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pos, setPos] = useState<Pos | null>(() => loadPos());
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  // Sticky tracking: remember the task even after the timer stops, until X.
  useEffect(() => {
    if (activeEntry) {
      setStickyTaskId(activeEntry.task_id);
      setDismissed(false);
    }
  }, [activeEntry?.id, activeEntry?.task_id]);

  // Tick the visible counter each second while running.
  useEffect(() => {
    if (!activeEntry) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeEntry?.id]);

  // Re-clamp on resize so the banner doesn't end up off-screen.
  useEffect(() => {
    const onResize = () => {
      const el = cardRef.current;
      if (!el || !pos) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setPos((prev) =>
        prev
          ? {
              x: clamp(prev.x, MARGIN, window.innerWidth - w - MARGIN),
              y: clamp(prev.y, MARGIN, window.innerHeight - h - MARGIN),
            }
          : prev,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  // Persist position
  useEffect(() => {
    if (!pos) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  const { data: task } = useTask(stickyTaskId);
  const { data: list } = useTaskList(task?.task_list_id);
  const { data: parentTask } = useTask(task?.parent_task_id);

  const start = useStartTimer();
  const stop = useStopTimer();

  if (!stickyTaskId || dismissed) return null;

  const isRunning = !!activeEntry;
  const elapsed = isRunning
    ? Math.floor((now - new Date(activeEntry.started_at).getTime()) / 1000)
    : 0;

  const taskTitle = task?.title?.trim() || "ללא כותרת";
  const listLabel = list
    ? `${list.emoji ? `${list.emoji} ` : ""}${list.name}`
    : null;
  const parentLabel = parentTask?.title?.trim() || null;

  const subtitleParts: string[] = [];
  if (listLabel) subtitleParts.push(listLabel);
  if (parentLabel) subtitleParts.push(`↳ ${parentLabel}`);
  const subtitle = subtitleParts.join(" · ") || "ללא רשימה";

  const toggle = () => {
    if (isRunning) stop.mutate();
    else start.mutate({ taskId: stickyTaskId });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start a drag from any interactive child (buttons).
    if ((e.target as HTMLElement).closest("button")) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: rect.left,
      baseY: rect.top,
    };
    el.setPointerCapture(e.pointerId);
    setIsDragging(true);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = cardRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPos({
      x: clamp(d.baseX + dx, MARGIN, window.innerWidth - w - MARGIN),
      y: clamp(d.baseY + dy, MARGIN, window.innerHeight - h - MARGIN),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    cardRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  // When pos is null, fall back to the original CSS-class anchored placement.
  // When pos is set, switch to absolute pixel positioning.
  const style: React.CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <div
      ref={cardRef}
      role="status"
      aria-live="polite"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={style}
      className={cn(
        "fixed z-40 pointer-events-auto",
        !pos && "bottom-20 md:bottom-4 end-4",
        "card !p-2 !pe-2.5 shadow-lift select-none",
        "flex items-center gap-2",
        "max-w-[calc(100vw-2rem)] sm:max-w-md",
        isDragging
          ? "cursor-grabbing transition-none"
          : "cursor-grab transition-shadow",
        isRunning &&
          "border-primary-300 bg-gradient-to-l from-primary-50 to-white",
      )}
    >
      <span
        className="shrink-0 text-ink-400 -ms-0.5 self-stretch flex items-center"
        aria-hidden
        title="גררי כדי להזיז"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      <span
        className={cn(
          "shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
          isRunning
            ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-accent"
            : "bg-ink-100 text-ink-500",
        )}
        aria-hidden
      >
        <Clock className="w-4 h-4" />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-ink-900 truncate">
            {taskTitle}
          </span>
          <span
            className={cn(
              "font-mono tabular-nums text-sm shrink-0",
              isRunning ? "text-primary-700 font-semibold" : "text-ink-500",
            )}
          >
            {formatElapsed(elapsed)}
          </span>
        </div>
        <div className="text-[11px] text-ink-500 truncate">{subtitle}</div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={start.isPending || stop.isPending}
        aria-label={isRunning ? "עצור סטופר" : "המשך סטופר"}
        title={isRunning ? "עצור" : "המשך"}
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isRunning
            ? "bg-danger-500 text-white hover:bg-danger-600"
            : "bg-primary-500 text-white hover:bg-primary-600",
        )}
      >
        {isRunning ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 ms-0.5" />
        )}
      </button>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="סגור באנר"
        title="סגור"
        className="shrink-0 w-7 h-7 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
