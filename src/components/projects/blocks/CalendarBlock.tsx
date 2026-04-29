import { useMemo, useState } from "react";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import {
  useTasksByProject,
  useTimeEntriesByRange,
} from "@/lib/hooks";
import type { Task, TimeEntry } from "@/lib/types/domain";

const DAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const MONTH_LABELS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

type CalView = "day" | "week" | "month";

/**
 * Project calendar with three views (day / week / month).
 *
 * Per spec §20.10: dashed stripe = planned (`tasks.scheduled_at`), solid stripe
 * = actual (rows from `time_entries`). The user reads-off variances at a glance
 * — if dashed and solid don't overlap, work shifted from its plan.
 *
 * Day/week renders an hour grid; month renders a 6×7 day grid with per-day
 * "actual hours" intensity. Navigation is prev/today/next + view toggle.
 */
export function CalendarBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const range = useMemo(() => computeRange(anchor, view), [anchor, view]);

  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: entries = [], isLoading } = useTimeEntriesByRange({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });

  const projectTaskIds = useMemo(
    () => new Set(tasks.map((t) => t.id)),
    [tasks]
  );
  const projectEntries = useMemo(
    () => entries.filter((e) => projectTaskIds.has(e.task_id ?? "")),
    [entries, projectTaskIds]
  );
  const scheduledTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.scheduled_at) return false;
        const ts = new Date(t.scheduled_at).getTime();
        return ts >= range.from.getTime() && ts <= range.to.getTime();
      }),
    [tasks, range]
  );

  const navigate = (dir: "prev" | "next" | "today") => {
    if (dir === "today") {
      setAnchor(startOfDay(new Date()));
      return;
    }
    const offset = dir === "prev" ? -1 : 1;
    setAnchor((a) => {
      const next = new Date(a);
      if (view === "day") next.setDate(next.getDate() + offset);
      else if (view === "week") next.setDate(next.getDate() + 7 * offset);
      else next.setMonth(next.getMonth() + offset);
      return startOfDay(next);
    });
  };

  if (!projectId || isLoading) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex items-center gap-0.5 bg-ink-100 rounded-sm p-0.5 text-[10px]">
          {(["day", "week", "month"] as CalView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={
                "px-2 py-0.5 rounded-xs transition-colors " +
                (view === v
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-200")
              }
            >
              {v === "day" ? "יום" : v === "week" ? "שבוע" : "חודש"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate("prev")}
            className="p-1 rounded hover:bg-ink-100 text-ink-600"
            aria-label="קודם"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => navigate("today")}
            className="text-[10px] px-1.5 py-0.5 rounded hover:bg-ink-100 text-ink-600"
          >
            היום
          </button>
          <button
            type="button"
            onClick={() => navigate("next")}
            className="p-1 rounded hover:bg-ink-100 text-ink-600"
            aria-label="הבא"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="text-[11px] font-medium text-ink-700 mb-1.5 text-center shrink-0">
        {labelForRange(anchor, view)}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {view === "day" && (
          <DayGrid
            date={anchor}
            entries={projectEntries}
            scheduled={scheduledTasks}
          />
        )}
        {view === "week" && (
          <WeekGrid
            anchor={anchor}
            entries={projectEntries}
            scheduled={scheduledTasks}
          />
        )}
        {view === "month" && (
          <MonthGrid
            anchor={anchor}
            entries={projectEntries}
            scheduled={scheduledTasks}
            onPickDay={(d) => {
              setAnchor(d);
              setView("day");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Day view: 24h column ───────────────────────────────────────────────────

function DayGrid({
  date,
  entries,
  scheduled,
}: {
  date: Date;
  entries: TimeEntry[];
  scheduled: Task[];
}) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const dayStart = startOfDay(date).getTime();
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const dayEntries = entries.filter((e) => {
    const s = new Date(e.started_at).getTime();
    return s < dayEnd && s >= dayStart - 12 * 3600 * 1000;
  });
  const dayScheduled = scheduled.filter((t) => {
    if (!t.scheduled_at) return false;
    const s = new Date(t.scheduled_at).getTime();
    return s >= dayStart && s < dayEnd;
  });

  return (
    <div className="relative">
      <ul>
        {hours.map((h) => (
          <li
            key={h}
            className="flex items-start gap-1 border-t border-ink-100 first:border-t-0 h-8"
          >
            <span className="w-7 shrink-0 text-[9px] text-ink-400 tabular-nums pt-0.5">
              {pad(h)}:00
            </span>
            <div className="flex-1 relative" />
          </li>
        ))}
      </ul>
      {/* Actual entries (solid) */}
      {dayEntries.map((e) => (
        <DayBar key={`a-${e.id}`} entry={e} dayStart={dayStart} solid />
      ))}
      {/* Planned (dashed) */}
      {dayScheduled.map((t) => (
        <DayPlannedBar key={`p-${t.id}`} task={t} dayStart={dayStart} />
      ))}
    </div>
  );
}

function DayBar({
  entry,
  dayStart,
  solid,
}: {
  entry: TimeEntry;
  dayStart: number;
  solid: boolean;
}) {
  const start = new Date(entry.started_at).getTime();
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : Date.now();
  const offsetMin = Math.max(0, (start - dayStart) / 60000);
  const durMin = Math.max(8, (end - start) / 60000); // floor 8 min for visibility
  // 24 hours × 32px (h-8) = 768px tall column.
  const top = (offsetMin / 60) * 32;
  const height = (durMin / 60) * 32;
  return (
    <div
      className={
        "absolute left-9 end-1 rounded text-[9px] leading-none px-1 py-0.5 truncate text-white " +
        (solid ? "bg-primary-500" : "bg-primary-300 border border-dashed")
      }
      style={{ top: `${top}px`, height: `${height}px` }}
      title={`סטופר ${fmtTime(entry.started_at)}${entry.ended_at ? " → " + fmtTime(entry.ended_at) : ""}`}
    >
      {fmtTime(entry.started_at)}
    </div>
  );
}

function DayPlannedBar({
  task,
  dayStart,
}: {
  task: Task;
  dayStart: number;
}) {
  if (!task.scheduled_at) return null;
  const start = new Date(task.scheduled_at).getTime();
  const offsetMin = Math.max(0, (start - dayStart) / 60000);
  const durMin = Math.max(15, task.duration_minutes ?? 60);
  const top = (offsetMin / 60) * 32;
  const height = (durMin / 60) * 32;
  return (
    <div
      className="absolute left-9 end-1 rounded text-[9px] leading-none px-1 py-0.5 truncate text-primary-700 bg-primary-50 border border-dashed border-primary-400"
      style={{ top: `${top}px`, height: `${height}px` }}
      title={`מתוכנן: ${task.title}`}
    >
      {task.title}
    </div>
  );
}

// ─── Week view: 7 day columns (compact) ─────────────────────────────────────

function WeekGrid({
  anchor,
  entries,
  scheduled,
}: {
  anchor: Date;
  entries: TimeEntry[];
  scheduled: Task[];
}) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hoursByDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of entries) {
      const s = new Date(e.started_at).getTime();
      const idx = Math.floor((s - weekStart.getTime()) / 86_400_000);
      if (idx < 0 || idx > 6) continue;
      const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
      m.set(idx, (m.get(idx) ?? 0) + (end - s) / 3_600_000);
    }
    return m;
  }, [entries, weekStart]);

  const plannedByDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of scheduled) {
      if (!t.scheduled_at) continue;
      const s = new Date(t.scheduled_at).getTime();
      const idx = Math.floor((s - weekStart.getTime()) / 86_400_000);
      if (idx < 0 || idx > 6) continue;
      const dur = (t.duration_minutes ?? 60) / 60;
      m.set(idx, (m.get(idx) ?? 0) + dur);
    }
    return m;
  }, [scheduled, weekStart]);

  const maxHours = Math.max(
    1,
    ...Array.from(hoursByDay.values()),
    ...Array.from(plannedByDay.values())
  );
  const todayMidnight = startOfDay(new Date()).getTime();

  return (
    <div className="grid grid-cols-7 gap-1.5 h-full min-h-[180px]">
      {days.map((d, i) => {
        const actual = hoursByDay.get(i) ?? 0;
        const planned = plannedByDay.get(i) ?? 0;
        const isToday = d.getTime() === todayMidnight;
        return (
          <div key={i} className="flex flex-col items-center gap-1 min-w-0">
            <div
              className={
                "text-[10px] " +
                (isToday
                  ? "text-primary-700 font-bold"
                  : "text-ink-500")
              }
            >
              {DAY_LABELS[d.getDay()]}
              <span className="text-ink-400 ms-0.5 tabular-nums">
                {d.getDate()}
              </span>
            </div>
            <div className="flex-1 w-full flex items-end justify-center gap-0.5 min-h-[60px]">
              {/* Planned (dashed) */}
              {planned > 0 && (
                <div
                  className="w-2 rounded-t-sm border border-dashed border-primary-400 bg-primary-50"
                  style={{
                    height: `${Math.max(8, (planned / maxHours) * 100)}%`,
                  }}
                  title={`מתוכנן: ${planned.toFixed(1)} ש`}
                />
              )}
              {/* Actual (solid) */}
              {actual > 0 && (
                <div
                  className={
                    "w-2 rounded-t-sm " +
                    (isToday ? "bg-primary-500" : "bg-primary-400")
                  }
                  style={{
                    height: `${Math.max(8, (actual / maxHours) * 100)}%`,
                  }}
                  title={`בפועל: ${actual.toFixed(1)} ש`}
                />
              )}
            </div>
            <div className="text-[9px] text-ink-500 tabular-nums">
              {actual.toFixed(1)}/{planned.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Month view: 6×7 day grid with intensity dots ──────────────────────────

function MonthGrid({
  anchor,
  entries,
  scheduled,
  onPickDay,
}: {
  anchor: Date;
  entries: TimeEntry[];
  scheduled: Task[];
  onPickDay: (d: Date) => void;
}) {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startOffset = firstOfMonth.getDay(); // Sun=0
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startOffset);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hoursByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const s = new Date(e.started_at);
      const k = isoDate(s);
      const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
      m.set(k, (m.get(k) ?? 0) + (end - s.getTime()) / 3_600_000);
    }
    return m;
  }, [entries]);

  const plannedByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of scheduled) {
      if (!t.scheduled_at) continue;
      const k = isoDate(new Date(t.scheduled_at));
      m.set(k, (m.get(k) ?? 0) + (t.duration_minutes ?? 60) / 60);
    }
    return m;
  }, [scheduled]);

  const maxHours = Math.max(
    1,
    ...Array.from(hoursByDay.values()),
    ...Array.from(plannedByDay.values())
  );
  const todayKey = isoDate(new Date());
  const currentMonth = anchor.getMonth();

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-0.5 text-[9px] text-ink-400 text-center">
        {DAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const k = isoDate(d);
          const actual = hoursByDay.get(k) ?? 0;
          const planned = plannedByDay.get(k) ?? 0;
          const isToday = k === todayKey;
          const offMonth = d.getMonth() !== currentMonth;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPickDay(d)}
              className={
                "flex flex-col items-center justify-start aspect-square rounded p-0.5 text-[9px] hover:ring-1 hover:ring-primary-500/40 transition-all " +
                (isToday
                  ? "bg-primary-100 text-primary-800 font-bold"
                  : offMonth
                  ? "text-ink-300"
                  : "text-ink-700 hover:bg-ink-50")
              }
            >
              <span className="tabular-nums">{d.getDate()}</span>
              <div className="flex-1 w-full flex items-end justify-center gap-0.5">
                {planned > 0 && (
                  <span
                    className="w-1 rounded-sm border border-dashed border-primary-400"
                    style={{
                      height: `${Math.max(4, (planned / maxHours) * 100)}%`,
                    }}
                  />
                )}
                {actual > 0 && (
                  <span
                    className="w-1 rounded-sm bg-primary-500"
                    style={{
                      height: `${Math.max(4, (actual / maxHours) * 100)}%`,
                    }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function computeRange(anchor: Date, view: CalView) {
  const from = startOfDay(anchor);
  const to = new Date(from);
  if (view === "day") to.setDate(to.getDate() + 1);
  else if (view === "week") {
    const start = startOfWeek(anchor);
    return { from: start, to: addDays(start, 7) };
  } else {
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { from: monthStart, to: monthEnd };
  }
  return { from, to };
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function labelForRange(anchor: Date, view: CalView): string {
  if (view === "day") {
    return `${pad(anchor.getDate())}/${pad(anchor.getMonth() + 1)}/${anchor.getFullYear()}`;
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    const e = addDays(s, 6);
    return `${pad(s.getDate())}/${pad(s.getMonth() + 1)} – ${pad(e.getDate())}/${pad(e.getMonth() + 1)}`;
  }
  return `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
