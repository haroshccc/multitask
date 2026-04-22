import { useParams } from "react-router-dom";
import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function ProjectDetail() {
  const { projectId } = useParams();
  return (
    <ScreenScaffold title="פרויקט" subtitle={`ID: ${projectId}`}>
      <ComingSoon description="המסך יכיל את כל הווידג'טים של עמוד הפרויקט — לוח זמנים, סטטיסטיקות, טבלת משימות עשירה, פרמטרי תמחור, חישוב בזמן אמת, תבניות, והעלאת הקלטה." />
    </ScreenScaffold>
  );
}
