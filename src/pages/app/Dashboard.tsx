import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import { UnprocessedThoughts } from "@/components/dashboard/widgets/UnprocessedThoughts";

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UnprocessedThoughts />
        <div className="card px-4 py-6 text-sm text-ink-500 md:col-span-2 lg:col-span-2">
          ווידג'טים נוספים (משימות היום, אירועים קרובים, פרויקטים פעילים,
          KPI השבוע, התראות) מגיעים בפאזות הבאות — ראה SPEC §14.
        </div>
      </div>
    </ScreenScaffold>
  );
}
