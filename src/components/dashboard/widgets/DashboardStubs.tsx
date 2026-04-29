import {
  CheckSquare,
  CalendarDays,
  Briefcase,
  TrendingUp,
  Bell,
} from "lucide-react";

/**
 * Dashboard stub widgets per SPEC §14. Each is a placeholder that shows the
 * intended title + hint, ready to be filled with real data in follow-up PRs.
 * Visual treatment matches existing widgets so the dashboard reads as a
 * cohesive set even before the real data is wired.
 */

function StubCard({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="card p-4 h-full flex flex-col">
      <div className="inline-flex items-center gap-2 mb-2">
        <span className="text-ink-500">{icon}</span>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <span className="chip-accent text-[10px]">בקרוב</span>
      </div>
      <p className="text-xs text-ink-500 leading-relaxed flex-1">{hint}</p>
    </div>
  );
}

export function TodaysTasksStub() {
  return (
    <StubCard
      icon={<CheckSquare className="w-4 h-4" />}
      title="המשימות שלי להיום"
      hint="המשימות הפתוחות עם תאריך יעד היום או בדחיפות גבוהה. יחובר אחרי שטבלת המשימות מקבלת קישור לפרויקטים."
    />
  );
}

export function UpcomingEventsStub() {
  return (
    <StubCard
      icon={<CalendarDays className="w-4 h-4" />}
      title="אירועים קרובים"
      hint="האירועים הקרובים מ-Google Calendar וממשימות עם is_event=true. רואה כותרת, שעה, מיקום."
    />
  );
}

export function ActiveProjectsStub() {
  return (
    <StubCard
      icon={<Briefcase className="w-4 h-4" />}
      title="פרויקטים פעילים"
      hint="כרטיסי פרויקטים פעילים עם פס התקדמות (אחוז משימות שהושלמו) וקיצור דרך לעמוד הפרויקט."
    />
  );
}

export function WeeklyKpisStub() {
  return (
    <StubCard
      icon={<TrendingUp className="w-4 h-4" />}
      title="KPI השבוע"
      hint="שעות נטו השבוע, % ביצוע מול תכנון, רווח שעתי, מספר משימות שהושלמו. נשען על רישומי הסטופר."
    />
  );
}

export function NotificationsStub() {
  return (
    <StubCard
      icon={<Bell className="w-4 h-4" />}
      title="התראות"
      hint="עדכונים מהמערכת — אישורי משימות, תזכורות, הודעות מצוות. מתחבר ל-notifications הקיים."
    />
  );
}
