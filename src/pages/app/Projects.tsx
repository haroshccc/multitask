import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Projects() {
  return (
    <ScreenScaffold
      title="פרויקטים ותמחור"
      subtitle="ניהול פרויקט, תמחור שעתי/קבוע, הצעות מחיר, מעקב רווח"
    >
      <ComingSoon description="דשבורד ווידג'טים פר פרויקט: טבלת משימות עשירה, מחשבון תמחור בזמן אמת, הוצאות חומרים, שאלות פתוחות, תבניות לשימוש חוזר." />
    </ScreenScaffold>
  );
}
