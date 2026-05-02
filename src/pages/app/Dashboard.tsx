import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  DashboardGrid,
  type WidgetDefinition,
} from "@/components/dashboard/DashboardGrid";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDateRange } from "@/lib/hooks/useDateRange";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { DashboardRangeContext } from "@/components/dashboard/dashboard-context";
import { UnprocessedThoughts } from "@/components/dashboard/widgets/UnprocessedThoughts";
import { RangeKpis } from "@/components/dashboard/widgets/RangeKpis";
import { RangeTasks } from "@/components/dashboard/widgets/RangeTasks";
import { RangeEvents } from "@/components/dashboard/widgets/RangeEvents";
import { RangeProjects } from "@/components/dashboard/widgets/RangeProjects";
import { NotificationsStub } from "@/components/dashboard/widgets/DashboardStubs";

/**
 * Home dashboard. The widget keys must remain stable — they're persisted in
 * `user_dashboard_layouts` so existing user layouts keep their positions.
 *
 * Phase 8.1: every widget is range-aware via DashboardRangeContext. The
 * top picker switches view (day/week/month) + steps the anchor; the URL
 * encodes the state so refresh keeps the view.
 */
const HOME_WIDGETS: WidgetDefinition[] = [
  {
    key: "todays_tasks",
    title: "משימות בטווח",
    component: RangeTasks,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 0, w: 4, h: 5 },
    defaultMobile: { x: 0, y: 0, w: 4, h: 5 },
  },
  {
    key: "upcoming_events",
    title: "אירועים בטווח",
    component: RangeEvents,
    chromeStyle: "bare",
    defaultDesktop: { x: 4, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
    defaultTablet: { x: 4, y: 0, w: 4, h: 5 },
    defaultMobile: { x: 0, y: 5, w: 4, h: 5 },
  },
  {
    key: "weekly_kpis",
    title: "KPI בטווח",
    component: RangeKpis,
    chromeStyle: "bare",
    defaultDesktop: { x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 5, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 10, w: 4, h: 4 },
  },
  {
    key: "active_projects",
    title: "פרויקטים פעילים",
    component: RangeProjects,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 5, w: 6, h: 4, minW: 4, minH: 3 },
    defaultTablet: { x: 0, y: 9, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 14, w: 4, h: 4 },
  },
  {
    key: "unprocessed_thoughts",
    title: "מחשבות לא מעובדות",
    component: UnprocessedThoughts,
    chromeStyle: "bare",
    defaultDesktop: { x: 6, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 13, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 18, w: 4, h: 4 },
  },
  {
    key: "notifications",
    title: "התראות",
    component: NotificationsStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 9, w: 12, h: 3, minW: 4, minH: 3 },
    defaultTablet: { x: 0, y: 17, w: 8, h: 3 },
    defaultMobile: { x: 0, y: 22, w: 4, h: 3 },
  },
];

export function Dashboard() {
  const { profile } = useAuth();
  const range = useDateRange();
  return (
    <DashboardRangeContext.Provider value={range}>
      <ScreenScaffold
        title={
          profile?.full_name
            ? `שלום, ${profile.full_name.split(" ")[0]} 👋`
            : "דשבורד"
        }
        subtitle="סקירה של המשימות, האירועים, המחשבות והפרויקטים שלך."
      >
        <div className="mt-3">
          <DateRangePicker range={range} />
        </div>
        <div className="mt-3">
          <DashboardGrid screenKey="home" widgets={HOME_WIDGETS} />
        </div>
      </ScreenScaffold>
    </DashboardRangeContext.Provider>
  );
}
