import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Calendar() {
  return (
    <ScreenScaffold title="יומן" subtitle="יום · שבוע · חודש · עם סנכרון ל-Google Calendar">
      <ComingSoon description="תצוגת יומן אינטראקטיבית עם משימות ואירועים, הבחנה ויזואלית בין מתוכנן (מקוקו) לבוצע (מלא), וסנכרון read-only ליומן ייעודי ב-Google." />
    </ScreenScaffold>
  );
}
