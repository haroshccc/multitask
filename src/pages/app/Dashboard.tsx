import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  DashboardGrid,
  type WidgetDefinition,
} from "@/components/dashboard/DashboardGrid";
import { useAuth } from "@/lib/auth/AuthContext";
import { UnprocessedThoughts } from "@/components/dashboard/widgets/UnprocessedThoughts";
import {
  TodaysTasksStub,
  UpcomingEventsStub,
  ActiveProjectsStub,
  WeeklyKpisStub,
  NotificationsStub,
} from "@/components/dashboard/widgets/DashboardStubs";

const HOME_WIDGETS: WidgetDefinition[] = [
  {
    key: "unprocessed_thoughts",
    title: "מחשבות לא מעובדות",
    component: UnprocessedThoughts,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 0, w: 4, h: 4 },
    defaultMobile: { x: 0, y: 0, w: 4, h: 4 },
  },
  {
    key: "todays_tasks",
    title: "המשימות שלי להיום",
    component: TodaysTasksStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 4, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    key: "upcoming_events",
    title: "אירועים קרובים",
    component: UpcomingEventsStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    key: "active_projects",
    title: "פרויקטים פעילים",
    component: ActiveProjectsStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  },
  {
    key: "weekly_kpis",
    title: "KPI השבוע",
    component: WeeklyKpisStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  },
  {
    key: "notifications",
    title: "התראות",
    component: NotificationsStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 8, w: 12, h: 3, minW: 4, minH: 3 },
  },
];

export function Dashboard() {
  const { profile } = useAuth();
  return (
    <ScreenScaffold
      title={
        profile?.full_name
          ? `שלום, ${profile.full_name.split(" ")[0]} 👋`
          : "דשבורד"
      }
      subtitle="סקירה של המשימות, האירועים, המחשבות והפרויקטים שלך להיום."
    >
      <DashboardGrid screenKey="home" widgets={HOME_WIDGETS} />
    </ScreenScaffold>
  );
}
