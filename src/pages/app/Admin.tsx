import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Building2, Loader2, Shield, Users } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { Organization } from "@/lib/types/domain";

export function Admin() {
  const { profile, loading } = useAuth();

  const orgs = useQuery({
    enabled: Boolean(profile?.is_super_admin),
    queryKey: ["admin", "organizations"] as const,
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useQuery({
    enabled: Boolean(profile?.is_super_admin),
    queryKey: ["admin", "totals"] as const,
    queryFn: async () => {
      const [{ count: orgsCount }, { count: usersCount }] = await Promise.all([
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      return { orgs: orgsCount ?? 0, users: usersCount ?? 0 };
    },
  });

  if (loading) return null;
  if (!profile?.is_super_admin) return <Navigate to="/app" replace />;

  return (
    <ScreenScaffold
      title="ניהול מערכת"
      subtitle="סקירה של כל הארגונים והמשתמשים (Super Admin)"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-ink-500">ארגונים</div>
            <div className="text-2xl font-bold text-ink-900 tabular-nums">
              {totals.data?.orgs ?? "…"}
            </div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-ink-500">משתמשים</div>
            <div className="text-2xl font-bold text-ink-900 tabular-nums">
              {totals.data?.users ?? "…"}
            </div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 bg-primary-50/40 border-primary-200">
          <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-ink-500">הרשאות</div>
            <div className="text-sm font-semibold text-ink-900">Super Admin</div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-ink-900 mb-3">ארגונים</h3>
        {orgs.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        ) : !orgs.data || orgs.data.length === 0 ? (
          <p className="text-sm text-ink-500">אין ארגונים במערכת.</p>
        ) : (
          <ul className="divide-y divide-ink-200">
            {orgs.data.map((org) => (
              <li key={org.id} className="py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {org.name}
                  </div>
                  <div className="text-xs text-ink-500 truncate">
                    {org.slug} · נוצר{" "}
                    {formatDistanceToNow(new Date(org.created_at), {
                      addSuffix: true,
                      locale: he,
                    })}
                    {org.suggested_email_domain && ` · דומיין ${org.suggested_email_domain}`}
                  </div>
                </div>
                {org.is_archived && <span className="chip">בארכיון</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4 mt-4 bg-ink-50">
        <h3 className="text-sm font-semibold text-ink-900 mb-1">פעולות עתידיות</h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          איפוס סיסמת הצטרפות, העברת משתמשים בין ארגונים, התחזות זמנית (עם
          audit log), וסטטיסטיקות שימוש יגיעו בגל הבא. הפעולות הרגישות יעברו
          דרך RPCs עם בדיקת{" "}
          <code className="font-mono">is_super_admin</code>.
        </p>
      </div>
    </ScreenScaffold>
  );
}
