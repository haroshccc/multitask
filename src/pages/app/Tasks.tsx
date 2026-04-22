import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Tasks() {
  return (
    <ScreenScaffold
      title="משימות"
      subtitle="רשימות עמודה-עמודה, היררכיה מלאה, גרירה בין רשימות."
    >
      <ComingSoon description="המסך יכיל עמודות של רשימות נגררות (פרויקטים + רשימות מותאמות), תת-משימות בכל עומק, סטופר, תלויות, ואפשרויות שיתוף." />
    </ScreenScaffold>
  );
}
