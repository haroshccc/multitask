import { useEffect, useState } from "react";
import {
  Building2,
  Loader2,
  Save,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { OrganizationMember, Profile } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type TabKey = "profile" | "organization";

export function Settings() {
  const [tab, setTab] = useState<TabKey>("profile");

  return (
    <ScreenScaffold title="הגדרות" subtitle="פרופיל אישי · ארגון">
      <div className="flex items-center gap-1 p-1 bg-ink-100 rounded-2xl mb-4 w-fit">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={UserIcon}>
          פרופיל
        </TabButton>
        <TabButton
          active={tab === "organization"}
          onClick={() => setTab("organization")}
          icon={Building2}
        >
          ארגון
        </TabButton>
      </div>

      {tab === "profile" && <ProfileTab />}
      {tab === "organization" && <OrganizationTab />}
    </ScreenScaffold>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
        active ? "bg-white shadow-soft text-ink-900" : "text-ink-600 hover:text-ink-900"
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function ProfileTab() {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [displayColor, setDisplayColor] = useState(profile?.display_color ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setDisplayColor(profile?.display_color ?? "");
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          display_color: displayColor.trim() || null,
        })
        .eq("id", profile.id);
      if (err) throw err;
      await refreshProfile();
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-semibold text-white shrink-0"
          style={{ background: displayColor || "#111118" }}
        >
          {(fullName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="text-sm text-ink-500">
          <div className="text-ink-900 font-medium">{user?.email}</div>
          <div className="text-xs">מזהה משתמש: {user?.id.slice(0, 8)}…</div>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink-800 mb-1 block">שם מלא</span>
        <input
          className="field"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="השם שלך"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink-800 mb-1 block">
          צבע אישי (hex)
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={displayColor || "#111118"}
            onChange={(e) => setDisplayColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-ink-300 cursor-pointer"
          />
          <input
            className="field flex-1 font-mono"
            value={displayColor}
            onChange={(e) => setDisplayColor(e.target.value)}
            placeholder="#111118"
          />
        </div>
        <span className="text-xs text-ink-500 mt-1 block">
          משמש לצביעת תיוגים ואווטאר בשיחות.
        </span>
      </label>

      {error && (
        <div className="text-xs text-danger-600 bg-danger-500/10 border border-danger-500/20 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="btn-accent">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          שמרי
        </button>
        {savedAt && Date.now() - savedAt < 3000 && (
          <span className="text-xs text-success-600">נשמר ✓</span>
        )}
      </div>
    </div>
  );
}

function OrganizationTab() {
  const { memberships, activeOrganizationId, setActiveOrganizationId } = useAuth();
  const activeMembership = memberships.find(
    (m) => m.organization_id === activeOrganizationId
  );

  const org = useQuery({
    queryKey: ["org-detail", activeOrganizationId ?? "none"],
    enabled: Boolean(activeOrganizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", activeOrganizationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["org-members", activeOrganizationId ?? "none"],
    enabled: Boolean(activeOrganizationId),
    queryFn: async (): Promise<
      (OrganizationMember & { profile: Profile | null })[]
    > => {
      const { data: memberRows, error } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", activeOrganizationId!);
      if (error) throw error;
      const ids = (memberRows ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids);
      if (profErr) throw profErr;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (memberRows ?? []).map((m) => ({
        ...m,
        profile: byId.get(m.user_id) ?? null,
      }));
    },
  });

  const qc = useQueryClient();
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (org.data) setOrgName(org.data.name);
  }, [org.data?.id]);

  const canEditOrg =
    activeMembership?.role === "owner" || activeMembership?.role === "admin";

  const handleSaveOrg = async () => {
    if (!activeOrganizationId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName.trim() })
        .eq("id", activeOrganizationId);
      if (error) throw error;
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["org-detail"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {memberships.length > 1 && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-ink-900 mb-2">ארגון פעיל</div>
          <select
            className="field"
            value={activeOrganizationId ?? ""}
            onChange={(e) => setActiveOrganizationId(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.organization_id} value={m.organization_id}>
                {m.organization_id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">פרטי הארגון</h3>
        {org.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        ) : org.data ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink-800 mb-1 block">שם הארגון</span>
              <input
                className="field"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canEditOrg}
              />
              {!canEditOrg && (
                <span className="text-xs text-ink-500 mt-1 block">
                  רק owner/admin יכולים לערוך.
                </span>
              )}
            </label>
            <div className="text-xs text-ink-500">
              Slug: <code className="font-mono">{org.data.slug}</code>
            </div>
            {canEditOrg && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveOrg}
                  disabled={saving || !orgName.trim()}
                  className="btn-accent"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  שמרי
                </button>
                {savedAt && Date.now() - savedAt < 3000 && (
                  <span className="text-xs text-success-600">נשמר ✓</span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-500">ארגון לא נטען.</p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">חברים</h3>
          <span className="chip">{members.data?.length ?? 0}</span>
        </div>
        {members.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        ) : (
          <ul className="divide-y divide-ink-200">
            {(members.data ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                  style={{ background: m.profile?.display_color || "#111118" }}
                >
                  {(m.profile?.full_name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 truncate">
                    {m.profile?.full_name ?? m.user_id.slice(0, 8)}
                  </div>
                </div>
                <span
                  className={cn(
                    "chip",
                    m.role === "owner"
                      ? "bg-primary-500/10 text-primary-700"
                      : m.role === "admin"
                        ? "bg-accent-purple/10 text-accent-purple"
                        : "bg-ink-200 text-ink-700"
                  )}
                >
                  {m.role === "owner" ? "בעלים" : m.role === "admin" ? "אדמין" : "חברה"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
