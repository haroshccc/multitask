import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Admin() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile?.is_super_admin) {
    return <Navigate to="/app" replace />;
  }
  return (
    <ScreenScaffold
      narrow
      title="ניהול מערכת (Super Admin)"
      subtitle="ניהול ארגונים, משתמשים, ואיפוס סיסמאות"
    >
      <ComingSoon description="מסך מוגן: ניהול ארגונים, העברת משתמשים, איפוס סיסמאות הצטרפות, התחזות זמנית למשתמש (עם audit log), וסטטיסטיקות מערכת." />
    </ScreenScaffold>
  );
}
