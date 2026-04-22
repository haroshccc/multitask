import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Recordings() {
  return (
    <ScreenScaffold
      title="הקלטות"
      subtitle="העלאה, תמלול עברית מעולה, הפרדת דוברים, וחילוץ משימות אוטומטי"
    >
      <ComingSoon description="רשימת הקלטות עם סטטוס תמלול, נגן משולב, תיוג דוברים (עד 5), חילוץ משימות לי/ללקוח באמצעות Claude Haiku, ומדיניות retention פר מקור." />
    </ScreenScaffold>
  );
}
