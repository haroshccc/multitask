import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils/cn";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { DashboardRangeContext } from "@/components/dashboard/dashboard-context";
import { BriefStrip } from "@/components/dashboard/sections/BriefStrip";
import { NowHero } from "@/components/dashboard/sections/NowHero";
import { TodayAgenda } from "@/components/dashboard/sections/TodayAgenda";
import { GoalsProgress } from "@/components/dashboard/sections/GoalsProgress";
import { ActionInbox } from "@/components/dashboard/sections/ActionInbox";
import { ReviewMode } from "@/components/dashboard/sections/ReviewMode";
import { MissingBeatTime } from "@/components/dashboard/widgets/MissingBeatTime";
import { RangeProjects } from "@/components/dashboard/widgets/RangeProjects";
import { RangeKpis } from "@/components/dashboard/widgets/RangeKpis";
import {
  startOfDay,
  staticWeekRange,
} from "@/components/dashboard/sections/static-range";

/**
 * Home dashboard — fixed, opinionated layout (replaced the configurable
 * DashboardGrid home screen). Built around four questions, in order:
 *
 *   1. מה עכשיו?            → NowHero
 *   2. איך נראה היום שלי?   → TodayAgenda (tasks + events on one axis)
 *   3. איך אני מתקדמת?      → GoalsProgress (+ MissingBeatTime when pending)
 *   4. מה מחכה לטיפול שלי?  → ActionInbox (notifications + thoughts)
 *
 * The AI brief collapses into a one-line strip at the top; weekly KPIs and
 * active projects keep their existing widgets in the secondary tier.
 * DashboardGrid itself still powers the Recordings screen — only the home
 * screen stopped using it (saved layouts in `user_dashboard_layouts` are
 * simply ignored).
 */

function greeting(fullName?: string | null): string {
  const h = new Date().getHours();
  const base =
    h < 5
      ? "לילה טוב"
      : h < 12
        ? "בוקר טוב"
        : h < 17
          ? "צהריים טובים"
          : h < 22
            ? "ערב טוב"
            : "לילה טוב";
  const first = fullName?.trim().split(" ")[0];
  return first ? `${base}, ${first} 👋` : `${base} 👋`;
}

type DashboardMode = "today" | "review";

const MODE_KEY = "multitask:dashboard:mode";

function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: DashboardMode;
  onChange: (m: DashboardMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-ink-100 p-0.5">
      {(
        [
          { value: "today", label: "היום" },
          { value: "review", label: "סקירה" },
        ] as const
      ).map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          aria-pressed={mode === m.value}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            mode === m.value
              ? "bg-white text-ink-900 shadow-sm"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<DashboardMode>(() => {
    if (typeof window === "undefined") return "today";
    return localStorage.getItem(MODE_KEY) === "review" ? "review" : "today";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const [agendaDate, setAgendaDate] = useState<Date>(() =>
    startOfDay(new Date()),
  );
  const weekCtx = useMemo(() => staticWeekRange(new Date()), []);
  const dateLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <ScreenScaffold
      title={
        mode === "today" ? greeting(profile?.full_name) : "סקירה שבועית"
      }
      subtitle={
        mode === "today"
          ? dateLabel
          : "מבט לאחור: מה הספקת, איך התקדמו היעדים, ומה אומר ה-AI."
      }
      actions={<ModeSwitcher mode={mode} onChange={setMode} />}
    >
      {mode === "review" ? (
        <ReviewMode />
      ) : (
        <div className="space-y-4">
          <BriefStrip />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 min-w-0 space-y-4">
              <NowHero />
              <TodayAgenda date={agendaDate} onDateChange={setAgendaDate} />
            </div>

            <div className="min-w-0 space-y-4">
              <GoalsProgress />
              <ActionInbox />
              <MissingBeatTime />
              <RangeProjects />
            </div>
          </div>

          <DashboardRangeContext.Provider value={weekCtx}>
            <RangeKpis />
          </DashboardRangeContext.Provider>
        </div>
      )}
    </ScreenScaffold>
  );
}
