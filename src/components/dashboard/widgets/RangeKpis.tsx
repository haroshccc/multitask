import { useMemo, useState, type ReactNode } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  Target,
  Mic,
  Users,
  Brain,
  ChevronDown,
} from "lucide-react";
import { useTasks } from "@/lib/hooks/useTasks";
import { useEvents } from "@/lib/hooks/useEvents";
import { useRecordings } from "@/lib/hooks/useRecordings";
import { useThoughts } from "@/lib/hooks/useThoughts";
import { useTimeEntriesByRange } from "@/lib/hooks/useTimer";
import { useDashboardRange } from "../dashboard-context";
import { cn } from "@/lib/utils/cn";
import type {
  Task,
  EventRow,
  Recording,
  Thought,
  TimeEntry,
} from "@/lib/types/domain";

const VIEW_LABEL: Record<string, string> = {
  day: "היום",
  week: "השבוע",
  month: "החודש",
};

const PREV_LABEL: Record<string, string> = {
  day: "אתמול",
  week: "שבוע שעבר",
  month: "חודש שעבר",
};

// -----------------------------------------------------------------------------
// Stats engine — pure, takes the data slice and a [from,to) ms range.

interface RangeStats {
  trackedSeconds: number;
  /** Distinct calendar days inside the range that have any time entry. */
  activeDays: number;
  /** Best hour-of-day (0-23) by tracked seconds. -1 if no data. */
  bestHourOfDay: number;
  /** Streak counter: consecutive days ending today (or anchor end) with tracking. */
  streakDays: number;
  /** Per-day tracked seconds map for sparkline rendering. */
  dailyTracked: Array<{ day: string; seconds: number }>;

  tasksCompleted: number;
  tasksScheduledInRange: number;
  tasksCreatedInRange: number;
  /** Tasks whose due_at falls in range and are still open. */
  tasksOverdue: number;
  /** Average seconds-to-completion for tasks completed in range (created_at → completed_at). */
  avgCompletionSeconds: number | null;

  meetingsCount: number;
  meetingsTotalSeconds: number;
  meetingsWithVideo: number;
  meetingsAvgSeconds: number | null;

  recordingsCount: number;
  recordingsTotalSeconds: number;
  /** Per-source breakdown for recordings inside range. */
  recordingsBySource: Record<string, number>;

  thoughtsCount: number;
  thoughtsProcessed: number;
  /** Per-source breakdown for thoughts inside range. */
  thoughtsBySource: Record<string, number>;
}

function inRange(iso: string | null | undefined, fromMs: number, toMs: number) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= fromMs && t < toMs;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStats(args: {
  range: { from: string; to: string };
  tasks: Task[];
  entries: TimeEntry[];
  events: EventRow[];
  recordings: Recording[];
  thoughts: Thought[];
}): RangeStats {
  const fromMs = new Date(args.range.from).getTime();
  const toMs = new Date(args.range.to).getTime();
  const nowMs = Date.now();

  // ---- Time entries ----
  let trackedSeconds = 0;
  const dayMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  for (const e of args.entries) {
    if (!e.duration_seconds || !e.started_at) continue;
    const startMs = new Date(e.started_at).getTime();
    if (startMs < fromMs || startMs >= toMs) continue;
    trackedSeconds += e.duration_seconds;

    const d = new Date(e.started_at);
    dayMap.set(dayKey(d), (dayMap.get(dayKey(d)) ?? 0) + e.duration_seconds);
    hourMap.set(d.getHours(), (hourMap.get(d.getHours()) ?? 0) + e.duration_seconds);
  }
  const activeDays = dayMap.size;
  let bestHourOfDay = -1;
  let bestHourSec = 0;
  for (const [h, s] of hourMap) {
    if (s > bestHourSec) {
      bestHourSec = s;
      bestHourOfDay = h;
    }
  }

  // Streak — walk back from min(now, range end) day-by-day until a day with no
  // entries is hit. Uses the full entries list (not filtered to range) so that
  // a streak built before the current range still counts.
  const allDays = new Set<string>();
  for (const e of args.entries) {
    if (!e.started_at || !e.duration_seconds) continue;
    allDays.add(dayKey(new Date(e.started_at)));
  }
  let streakDays = 0;
  const today = new Date(Math.min(nowMs, toMs - 1));
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (allDays.has(dayKey(d))) streakDays++;
    else break;
  }

  const dailyTracked = Array.from(dayMap.entries())
    .map(([day, seconds]) => ({ day, seconds }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // ---- Tasks ----
  let tasksCompleted = 0;
  let tasksScheduledInRange = 0;
  let tasksCreatedInRange = 0;
  let tasksOverdue = 0;
  let completionSecondsSum = 0;
  let completionSecondsCount = 0;
  for (const t of args.tasks) {
    if (inRange(t.completed_at, fromMs, toMs)) {
      tasksCompleted++;
      if (t.created_at) {
        const dur =
          (new Date(t.completed_at!).getTime() -
            new Date(t.created_at).getTime()) /
          1000;
        if (dur > 0) {
          completionSecondsSum += dur;
          completionSecondsCount++;
        }
      }
    }
    if (inRange(t.scheduled_at, fromMs, toMs)) tasksScheduledInRange++;
    if (inRange(t.created_at, fromMs, toMs)) tasksCreatedInRange++;
    // Overdue = scheduled in range, scheduled time has passed, still open.
    // (No separate due_at column today — scheduled_at is the de-facto deadline.)
    if (
      inRange(t.scheduled_at, fromMs, toMs) &&
      new Date(t.scheduled_at!).getTime() < nowMs &&
      !t.completed_at
    ) {
      tasksOverdue++;
    }
  }
  const avgCompletionSeconds =
    completionSecondsCount > 0
      ? completionSecondsSum / completionSecondsCount
      : null;

  // ---- Events (meetings) ----
  let meetingsCount = 0;
  let meetingsTotalSeconds = 0;
  let meetingsWithVideo = 0;
  for (const ev of args.events) {
    if (!inRange(ev.starts_at, fromMs, toMs)) continue;
    meetingsCount++;
    if (ev.starts_at && ev.ends_at) {
      const dur =
        (new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime()) /
        1000;
      if (dur > 0) meetingsTotalSeconds += dur;
    }
    if (ev.video_call_url) meetingsWithVideo++;
  }
  const meetingsAvgSeconds =
    meetingsCount > 0 ? meetingsTotalSeconds / meetingsCount : null;

  // ---- Recordings ----
  let recordingsCount = 0;
  let recordingsTotalSeconds = 0;
  const recordingsBySource: Record<string, number> = {};
  for (const r of args.recordings) {
    if (!inRange(r.created_at, fromMs, toMs)) continue;
    recordingsCount++;
    if (r.duration_seconds) recordingsTotalSeconds += r.duration_seconds;
    recordingsBySource[r.source] = (recordingsBySource[r.source] ?? 0) + 1;
  }

  // ---- Thoughts ----
  let thoughtsCount = 0;
  let thoughtsProcessed = 0;
  const thoughtsBySource: Record<string, number> = {};
  for (const th of args.thoughts) {
    if (!inRange(th.created_at, fromMs, toMs)) continue;
    thoughtsCount++;
    if (th.processed_at) thoughtsProcessed++;
    thoughtsBySource[th.source] = (thoughtsBySource[th.source] ?? 0) + 1;
  }

  return {
    trackedSeconds,
    activeDays,
    bestHourOfDay,
    streakDays,
    dailyTracked,
    tasksCompleted,
    tasksScheduledInRange,
    tasksCreatedInRange,
    tasksOverdue,
    avgCompletionSeconds,
    meetingsCount,
    meetingsTotalSeconds,
    meetingsWithVideo,
    meetingsAvgSeconds,
    recordingsCount,
    recordingsTotalSeconds,
    recordingsBySource,
    thoughtsCount,
    thoughtsProcessed,
    thoughtsBySource,
  };
}

// -----------------------------------------------------------------------------
// Range helpers — derive the previous comparable period from the current one.

function shiftRange(
  range: { from: string; to: string },
  view: "day" | "week" | "month"
): { from: string; to: string } {
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (view === "day") {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (view === "week") {
    from.setDate(from.getDate() - 7);
    to.setDate(to.getDate() - 7);
  } else {
    from.setMonth(from.getMonth() - 1);
    to.setMonth(to.getMonth() - 1);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

// -----------------------------------------------------------------------------
// Formatters

function formatHours(seconds: number): string {
  if (seconds <= 0) return "0";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h}:${String(m).padStart(2, "0")} שע׳`;
}

function formatMinutesShort(seconds: number): string {
  if (seconds <= 0) return "0 דק׳";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} שע׳` : `${h}ש ${r}ד`;
}

function formatHourBlock(h: number): string {
  if (h < 0) return "—";
  return `${String(h).padStart(2, "0")}:00`;
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

// -----------------------------------------------------------------------------
// Hero card UI — collapsed by default, click to reveal sub-metrics.

interface HeroCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  /** Optional secondary line shown under the hero value. */
  caption?: string | null;
  trend?: { delta: number; tone: "up" | "down" | "flat"; label: string } | null;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
  tone?: "primary" | "success" | "warn" | "violet" | "rose" | "ink";
}

function HeroCard({
  icon,
  label,
  value,
  caption,
  trend,
  expanded,
  onToggle,
  children,
  tone = "ink",
}: HeroCardProps) {
  const toneClass = {
    primary: "text-primary-700 bg-primary-50",
    success: "text-emerald-700 bg-emerald-50",
    warn: "text-amber-700 bg-amber-50",
    violet: "text-violet-700 bg-violet-50",
    rose: "text-rose-700 bg-rose-50",
    ink: "text-ink-700 bg-ink-50",
  }[tone];

  return (
    <div className="rounded-lg border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full p-2.5 text-start transition-colors",
          "hover:bg-ink-50/50 focus:outline-none focus:bg-ink-50/50"
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
              toneClass
            )}
          >
            {icon}
            {label}
          </span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-ink-400 ms-auto transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-semibold text-ink-900 tabular-nums leading-none">
            {value}
          </span>
          {trend && <TrendChip {...trend} />}
        </div>
        {caption && (
          <div className="mt-0.5 text-[11px] text-ink-500 tabular-nums">
            {caption}
          </div>
        )}
      </button>
      {expanded && children && (
        <div className="border-t border-ink-100 bg-ink-50/40 px-2.5 py-2">
          {children}
        </div>
      )}
    </div>
  );
}

function TrendChip({
  delta,
  tone,
  label,
}: {
  delta: number;
  tone: "up" | "down" | "flat";
  label: string;
}) {
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
  const cls =
    tone === "up"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "down"
        ? "text-rose-700 bg-rose-50"
        : "text-ink-500 bg-ink-100";
  const sign = delta > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums",
        cls
      )}
      title={`${label}`}
    >
      <Icon className="w-3 h-3" />
      {sign}
      {delta}%
    </span>
  );
}

function trendOf(curr: number, prev: number): {
  delta: number;
  tone: "up" | "down" | "flat";
  label: string;
} {
  if (prev <= 0 && curr <= 0) {
    return { delta: 0, tone: "flat", label: "אין נתונים בטווח הקודם" };
  }
  if (prev <= 0) {
    return { delta: 100, tone: "up", label: "אין השוואה — היה 0" };
  }
  const ratio = (curr - prev) / prev;
  const delta = Math.round(ratio * 100);
  const tone = delta > 2 ? "up" : delta < -2 ? "down" : "flat";
  return { delta, tone, label: `מול ${prev}` };
}

// -----------------------------------------------------------------------------
// Mini sub-metric grid + sparkline used inside the expanded panels.

function SubGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((it) => (
        <div key={it.label} className="rounded bg-white border border-ink-100 px-2 py-1.5">
          <div className="text-[10px] text-ink-500">{it.label}</div>
          <div className="text-sm font-semibold text-ink-900 tabular-nums mt-0.5">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({
  data,
  height = 28,
}: {
  data: Array<{ day: string; seconds: number }>;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="text-[10px] text-ink-400 text-center py-1">
        אין נתונים יומיים
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.seconds), 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((d) => {
        const h = Math.max(2, (d.seconds / max) * height);
        return (
          <div
            key={d.day}
            className="flex-1 bg-primary-400 rounded-sm"
            style={{ height: h }}
            title={`${d.day} · ${formatHours(d.seconds)}`}
          />
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Source label maps for breakdowns

const RECORDING_SOURCE_LABEL: Record<string, string> = {
  thought: "מחשבה",
  call: "שיחה",
  meeting: "פגישה",
  other: "אחר",
};

const THOUGHT_SOURCE_LABEL: Record<string, string> = {
  app_text: "טקסט",
  app_audio: "אודיו",
  whatsapp_text: "WA · טקסט",
  whatsapp_audio: "WA · אודיו",
  whatsapp_image: "WA · תמונה",
  whatsapp_file: "WA · קובץ",
};

function breakdownLines(
  map: Record<string, number>,
  labels: Record<string, string>
): string {
  const parts = Object.entries(map)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${labels[k] ?? k}: ${n}`);
  return parts.length === 0 ? "—" : parts.join(" · ");
}

// -----------------------------------------------------------------------------
// Main widget

export function RangeKpis() {
  const range = useDashboardRange();
  const prevRange = useMemo(
    () => shiftRange(range.range, range.view),
    [range.range, range.view]
  );

  // Pull data once and slice in JS — same hooks as other widgets, no extra
  // queries per range. Tasks/recordings/thoughts come back full org-scope so
  // we can also compare to the previous period from the same payload.
  const { data: tasks = [] } = useTasks();
  const { data: recordings = [] } = useRecordings();
  const { data: thoughts = [] } = useThoughts({ includeArchived: true });
  // Pull events covering both current + previous range so we can compare.
  const eventsRangeUnion = useMemo(
    () => ({
      from: prevRange.from < range.range.from ? prevRange.from : range.range.from,
      to: prevRange.to > range.range.to ? prevRange.to : range.range.to,
    }),
    [prevRange, range.range]
  );
  const { data: events = [] } = useEvents(eventsRangeUnion);
  // Time entries: same union range — single fetch covers both periods.
  const { data: entries = [] } = useTimeEntriesByRange(eventsRangeUnion);

  const stats = useMemo(
    () =>
      computeStats({
        range: range.range,
        tasks,
        entries,
        events,
        recordings,
        thoughts,
      }),
    [range.range, tasks, entries, events, recordings, thoughts]
  );
  const prevStats = useMemo(
    () =>
      computeStats({
        range: prevRange,
        tasks,
        entries,
        events,
        recordings,
        thoughts,
      }),
    [prevRange, tasks, entries, events, recordings, thoughts]
  );

  // Per-card expansion state (local — UX preference, doesn't justify DB).
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) =>
    setOpen((prev) => ({ ...prev, [k]: !prev[k] }));

  // Derived for the ביצוע card.
  const completionRate = pct(stats.tasksCompleted, stats.tasksScheduledInRange);
  const prevCompletionRate = pct(
    prevStats.tasksCompleted,
    prevStats.tasksScheduledInRange
  );

  // Focus ratio: tracked time minus meeting time, as % of tracked time.
  const focusSeconds = Math.max(0, stats.trackedSeconds - stats.meetingsTotalSeconds);
  const prevFocusSeconds = Math.max(
    0,
    prevStats.trackedSeconds - prevStats.meetingsTotalSeconds
  );

  const periodLabel = VIEW_LABEL[range.view] ?? "";
  const prevLabel = PREV_LABEL[range.view] ?? "תקופה קודמת";

  return (
    <div className="card p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <TrendingUp className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-ink-900">KPI {periodLabel}</h3>
        <span className="ms-auto text-[10px] text-ink-500">
          לחיצה על כרטיסיה — פירוט
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto pe-1 scrollbar-thin">
        <div className="grid grid-cols-2 gap-2">
          {/* 1. זמן עבודה */}
          <HeroCard
            icon={<Clock className="w-3 h-3" />}
            label="זמן עבודה"
            tone="primary"
            value={formatHours(stats.trackedSeconds)}
            caption={
              stats.streakDays > 0 ? `Streak: ${stats.streakDays} ימים רצוף` : null
            }
            trend={trendOf(stats.trackedSeconds, prevStats.trackedSeconds)}
            expanded={!!open.time}
            onToggle={() => toggle("time")}
          >
            <div className="space-y-2">
              <SubGrid
                items={[
                  {
                    label: "ימים פעילים",
                    value: String(stats.activeDays),
                  },
                  {
                    label: "שעת שיא",
                    value: formatHourBlock(stats.bestHourOfDay),
                  },
                  {
                    label: prevLabel,
                    value: formatHours(prevStats.trackedSeconds),
                  },
                  {
                    label: "Streak",
                    value: stats.streakDays > 0 ? `${stats.streakDays} ימים` : "—",
                  },
                ]}
              />
              {range.view !== "day" && (
                <div>
                  <div className="text-[10px] text-ink-500 mb-1">
                    התפלגות יומית
                  </div>
                  <Sparkline data={stats.dailyTracked} />
                </div>
              )}
            </div>
          </HeroCard>

          {/* 2. משימות שהושלמו */}
          <HeroCard
            icon={<CheckCircle2 className="w-3 h-3" />}
            label="משימות שהושלמו"
            tone="success"
            value={String(stats.tasksCompleted)}
            caption={
              stats.tasksOverdue > 0 ? `${stats.tasksOverdue} באיחור` : null
            }
            trend={trendOf(stats.tasksCompleted, prevStats.tasksCompleted)}
            expanded={!!open.tasks}
            onToggle={() => toggle("tasks")}
          >
            <SubGrid
              items={[
                { label: "חדשות שנוצרו", value: String(stats.tasksCreatedInRange) },
                { label: "באיחור", value: String(stats.tasksOverdue) },
                {
                  label: "ממוצע זמן לסיום",
                  value:
                    stats.avgCompletionSeconds !== null
                      ? formatHours(stats.avgCompletionSeconds)
                      : "—",
                },
                {
                  label: prevLabel,
                  value: String(prevStats.tasksCompleted),
                },
              ]}
            />
          </HeroCard>

          {/* 3. ביצוע % */}
          <HeroCard
            icon={<Target className="w-3 h-3" />}
            label="ביצוע"
            tone="warn"
            value={
              stats.tasksScheduledInRange > 0 ? `${completionRate}%` : "—"
            }
            caption={
              stats.tasksScheduledInRange > 0
                ? `${stats.tasksCompleted} מתוך ${stats.tasksScheduledInRange} מתוזמנות`
                : "אין משימות מתוזמנות בטווח"
            }
            trend={
              stats.tasksScheduledInRange > 0 || prevStats.tasksScheduledInRange > 0
                ? trendOf(completionRate, prevCompletionRate)
                : null
            }
            expanded={!!open.completion}
            onToggle={() => toggle("completion")}
          >
            <SubGrid
              items={[
                {
                  label: "הושלמו בטווח",
                  value: String(stats.tasksCompleted),
                },
                {
                  label: "מתוזמנות בטווח",
                  value: String(stats.tasksScheduledInRange),
                },
                {
                  label: "פוקוס נטו",
                  value: formatHours(focusSeconds),
                },
                {
                  label: `פוקוס ${prevLabel}`,
                  value: formatHours(prevFocusSeconds),
                },
              ]}
            />
          </HeroCard>

          {/* 4. פגישות */}
          <HeroCard
            icon={<Users className="w-3 h-3" />}
            label="פגישות"
            tone="violet"
            value={String(stats.meetingsCount)}
            caption={
              stats.meetingsCount > 0
                ? formatHours(stats.meetingsTotalSeconds)
                : null
            }
            trend={trendOf(stats.meetingsCount, prevStats.meetingsCount)}
            expanded={!!open.meetings}
            onToggle={() => toggle("meetings")}
          >
            <SubGrid
              items={[
                {
                  label: "סה״כ שעות",
                  value: formatHours(stats.meetingsTotalSeconds),
                },
                {
                  label: "ממוצע משך",
                  value:
                    stats.meetingsAvgSeconds !== null
                      ? formatMinutesShort(stats.meetingsAvgSeconds)
                      : "—",
                },
                {
                  label: "עם וידאו",
                  value: `${stats.meetingsWithVideo}/${stats.meetingsCount || 0}`,
                },
                {
                  label: prevLabel,
                  value: String(prevStats.meetingsCount),
                },
              ]}
            />
          </HeroCard>

          {/* 5. הקלטות */}
          <HeroCard
            icon={<Mic className="w-3 h-3" />}
            label="הקלטות"
            tone="rose"
            value={String(stats.recordingsCount)}
            caption={
              stats.recordingsCount > 0
                ? formatMinutesShort(stats.recordingsTotalSeconds)
                : null
            }
            trend={trendOf(stats.recordingsCount, prevStats.recordingsCount)}
            expanded={!!open.recordings}
            onToggle={() => toggle("recordings")}
          >
            <div className="space-y-2">
              <SubGrid
                items={[
                  {
                    label: "סה״כ דקות",
                    value: formatMinutesShort(stats.recordingsTotalSeconds),
                  },
                  {
                    label: prevLabel,
                    value: String(prevStats.recordingsCount),
                  },
                ]}
              />
              <div className="rounded bg-white border border-ink-100 px-2 py-1.5">
                <div className="text-[10px] text-ink-500 mb-0.5">לפי מקור</div>
                <div className="text-[11px] text-ink-700 leading-relaxed">
                  {breakdownLines(stats.recordingsBySource, RECORDING_SOURCE_LABEL)}
                </div>
              </div>
            </div>
          </HeroCard>

          {/* 6. מחשבות */}
          <HeroCard
            icon={<Brain className="w-3 h-3" />}
            label="מחשבות"
            tone="ink"
            value={String(stats.thoughtsCount)}
            caption={
              stats.thoughtsCount > 0
                ? `עיבוד: ${pct(stats.thoughtsProcessed, stats.thoughtsCount)}%`
                : null
            }
            trend={trendOf(stats.thoughtsCount, prevStats.thoughtsCount)}
            expanded={!!open.thoughts}
            onToggle={() => toggle("thoughts")}
          >
            <div className="space-y-2">
              <SubGrid
                items={[
                  {
                    label: "מעובדות",
                    value: `${stats.thoughtsProcessed}/${stats.thoughtsCount || 0}`,
                  },
                  {
                    label: "שיעור עיבוד",
                    value: stats.thoughtsCount
                      ? `${pct(stats.thoughtsProcessed, stats.thoughtsCount)}%`
                      : "—",
                  },
                  {
                    label: prevLabel,
                    value: String(prevStats.thoughtsCount),
                  },
                  {
                    label: `עיבוד ${prevLabel}`,
                    value: prevStats.thoughtsCount
                      ? `${pct(prevStats.thoughtsProcessed, prevStats.thoughtsCount)}%`
                      : "—",
                  },
                ]}
              />
              <div className="rounded bg-white border border-ink-100 px-2 py-1.5">
                <div className="text-[10px] text-ink-500 mb-0.5">לפי מקור</div>
                <div className="text-[11px] text-ink-700 leading-relaxed">
                  {breakdownLines(stats.thoughtsBySource, THOUGHT_SOURCE_LABEL)}
                </div>
              </div>
            </div>
          </HeroCard>
        </div>
      </div>
    </div>
  );
}
