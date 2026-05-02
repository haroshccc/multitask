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
import { BriefBanner } from "@/components/dashboard/widgets/BriefBanner";
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
  // Phase 8.2 — AI brief banner. First item, full-width, tall enough to fit
  // the headline + summary + people + recommendations + a few proposals
  // before the user has to scroll inside the widget.
  {
    key: "ai_brief",
    title: "סיכום AI",
    component: BriefBanner,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 0, w: 12, h: 7, minW: 6, minH: 5 },
    defaultTablet: { x: 0, y: 0, w: 8, h: 7 },
    defaultMobile: { x: 0, y: 0, w: 4, h: 8 },
  },
  {
    key: "todays_tasks",
    title: "משימות בטווח",
    component: RangeTasks,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 7, w: 4, h: 5, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 7, w: 4, h: 5 },
    defaultMobile: { x: 0, y: 8, w: 4, h: 5 },
  },
  {
    key: "upcoming_events",
    title: "אירועים בטווח",
    component: RangeEvents,
    chromeStyle: "bare",
    defaultDesktop: { x: 4, y: 7, w: 4, h: 5, minW: 3, minH: 3 },
    defaultTablet: { x: 4, y: 7, w: 4, h: 5 },
    defaultMobile: { x: 0, y: 13, w: 4, h: 5 },
  },
  {
    key: "weekly_kpis",
    title: "KPI בטווח",
    component: RangeKpis,
    chromeStyle: "bare",
    // 6 hero cards in a 2×3 grid + per-card expansion.
    defaultDesktop: { x: 8, y: 7, w: 4, h: 7, minW: 3, minH: 5 },
    defaultTablet: { x: 0, y: 12, w: 8, h: 6 },
    defaultMobile: { x: 0, y: 18, w: 4, h: 7 },
  },
  {
    key: "active_projects",
    title: "פרויקטים פעילים",
    component: RangeProjects,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 12, w: 8, h: 4, minW: 4, minH: 3 },
    defaultTablet: { x: 0, y: 18, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 25, w: 4, h: 4 },
  },
  {
    key: "unprocessed_thoughts",
    title: "מחשבות לא מעובדות",
    component: UnprocessedThoughts,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 16, w: 12, h: 4, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 22, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 29, w: 4, h: 4 },
  },
  {
    key: "notifications",
    title: "התראות",
    component: NotificationsStub,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 20, w: 12, h: 3, minW: 4, minH: 3 },
    defaultTablet: { x: 0, y: 26, w: 8, h: 3 },
    defaultMobile: { x: 0, y: 33, w: 4, h: 3 },
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
