import { useMemo } from "react";
import { Frame, Flame, Award, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DAY_OF_WEEK_LABELS, type DayOfWeek } from "@/lib/types/domain";
import { useFrameworks, useFrameworkContentForMany } from "@/lib/hooks/useFrameworks";
import { minutesToHHMM } from "@/lib/frameworks/projection";
import {
  computeFrameworkBlockGoal,
  doneDatesForBlock,
  type FrameworkGoalStats,
} from "@/lib/frameworks/goals";
import type { Framework, FrameworkBlock } from "@/lib/types/frameworks";
import type { FrameworkContent } from "@/lib/services/frameworks";

const PERIOD_NOW: Record<FrameworkGoalStats["period"], string> = {
  day: "היום",
  week: "השבוע",
  month: "החודש",
};
const PERIOD_EVERY: Record<FrameworkGoalStats["period"], string> = {
  day: "ביום",
  week: "בשבוע",
  month: "בחודש",
};

interface GoalEntry {
  framework: Framework;
  block: FrameworkBlock;
  stats: FrameworkGoalStats;
  doneDates: string[];
}

/**
 * The "מסגרות" area on the Goals page. Renders each framework block that carries
 * a goal as its own progress card, sourced from the framework's occurrence
 * state. Self-contained — does not touch the task-goal code on the page.
 */
export function FrameworkGoalsSection() {
  const { data: frameworks = [] } = useFrameworks();
  const frameworkIds = useMemo(() => frameworks.map((f) => f.id), [frameworks]);
  const { data: contentById = {} } = useFrameworkContentForMany(frameworkIds);

  const entries = useMemo<GoalEntry[]>(() => {
    const out: GoalEntry[] = [];
    for (const framework of frameworks) {
      const content: FrameworkContent | undefined = contentById[framework.id];
      if (!content) continue;
      for (const block of content.blocks) {
        if (block.scope !== "weekly" || !block.goal_period) continue;
        const doneDates = doneDatesForBlock(content.occurrences, block.id);
        const stats = computeFrameworkBlockGoal(block, doneDates);
        if (!stats) continue;
        out.push({ framework, block, stats, doneDates });
      }
    }
    return out.sort((a, b) => a.framework.name.localeCompare(b.framework.name));
  }, [frameworks, contentById]);

  if (entries.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Frame className="w-4 h-4 text-ink-600" />
        <h2 className="text-sm font-semibold text-ink-800">יעדי מסגרת</h2>
        <span className="text-[11px] bg-ink-100 text-ink-500 rounded-full px-1.5 py-0.5">
          {entries.length}
        </span>
        <div className="flex-1 h-px bg-ink-200" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => (
          <FrameworkGoalCard key={e.block.id} entry={e} />
        ))}
      </div>
    </section>
  );
}

function FrameworkGoalCard({ entry }: { entry: GoalEntry }) {
  const { framework, block, stats } = entry;
  const color = block.color ?? framework.color ?? "#6366f1";
  const progressPct = Math.min(100, Math.round((stats.currentPeriodCount / stats.target) * 100));
  const dow = block.day_of_week != null ? DAY_OF_WEEK_LABELS[block.day_of_week as DayOfWeek] : "";

  return (
    <article className="card p-4 border-2" style={{ borderColor: color + "66" }}>
      <div className="flex items-start gap-2 mb-2">
        <Target className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-900 truncate">
            {block.title || "בלוק ללא שם"}
          </h3>
          <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: color + "1a", color }}
            >
              <Frame className="w-3 h-3" />
              {framework.name}
            </span>
            <span>
              {dow} · {minutesToHHMM(block.start_minute)}–{minutesToHHMM(block.end_minute)}
            </span>
            <span>·</span>
            <span>
              {stats.target} פעמים {PERIOD_EVERY[stats.period]}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs text-ink-600">{PERIOD_NOW[stats.period]}</span>
          <span className="text-xs font-medium text-ink-900 tabular-nums">
            {stats.currentPeriodCount} / {stats.target}
            {stats.currentPeriodHit && <span className="ms-1 text-success-600">✓</span>}
          </span>
        </div>
        <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all")}
            style={{
              width: `${progressPct}%`,
              background: stats.currentPeriodHit ? "#10b981" : color,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px]">
        <span className="inline-flex items-center gap-1 text-ink-600">
          <Flame className="w-3 h-3" style={{ color: stats.currentStreak > 0 ? "#d97706" : undefined }} />
          סטריק {stats.currentStreak}
        </span>
        <span className="inline-flex items-center gap-1 text-ink-600">
          <Award className="w-3 h-3" />
          {stats.recentHits}/{stats.recentTotal} אחרונים
        </span>
      </div>
    </article>
  );
}
