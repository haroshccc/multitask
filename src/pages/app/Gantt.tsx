import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Gantt() {
  return (
    <ScreenScaffold title="Gantt" subtitle="ציר זמן אופקי עם תלויות וחישוב Critical Path">
      <ComingSoon description="Gantt מותאם עם drag של משכים, חיצי תלויות (4 סוגי relation), זום יום/שבוע/חודש/רבעון, ו-critical path אוטומטי." />
    </ScreenScaffold>
  );
}
