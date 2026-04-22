import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";

export function Dashboard() {
  const { profile } = useAuth();
  return (
    <ScreenScaffold
      title={profile?.full_name ? `שלום, ${profile.full_name.split(" ")[0]} 👋` : "דשבורד"}
      subtitle="סקירה של המשימות, האירועים, המחשבות והפרויקטים שלך להיום."
    >
      <ComingSoon description="מסך הבית יציג ווידג'טים נגררים: משימות היום, אירועים קרובים, מחשבות לא מעובדות, פרויקטים פעילים, והתראות אחרונות. מגיע בשלב הבא." />
    </ScreenScaffold>
  );
}
