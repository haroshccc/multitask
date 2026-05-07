import { useState, useMemo } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import {
  User, Building2, Users, Bell, Trash2, Mail, Copy, Check,
  Shield, Clock, Plus, ChevronDown, ChevronUp, ArrowUpRight,
  ArrowDownLeft, CheckCircle2, AlertCircle, MessageCircle,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import { useTasks } from "@/lib/hooks/useTasks";
import {
  useOrganization,
  useUserOrganizations,
  useUpdateOrganization,
  useCreateOrganization,
  useDeleteOrganization,
  useOrgInvites,
  useCreateInvite,
  useRevokeInvite,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/lib/hooks/useOrganizations";
import type { OrgType } from "@/lib/services/organizations";

type Tab = "profile" | "organization" | "sharing" | "notifications";

interface TabDef { key: Tab; label: string; icon: LucideIcon; }

const TABS: TabDef[] = [
  { key: "profile",       label: "פרופיל",      icon: User },
  { key: "organization",  label: "ניהול קבוצה",  icon: Building2 },
  { key: "sharing",       label: "שיתופים",      icon: Users },
  { key: "notifications", label: "התראות",       icon: Bell },
];

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  business: "עסקי",
  family:   "משפחה",
  personal: "אישי",
};

const ORG_TYPE_ICONS: Record<OrgType, LucideIcon> = {
  business: Building2,
  family:   Users,
  personal: User,
};

const ROLE_LABELS: Record<string, string> = {
  owner:  "בעלים",
  admin:  "מנהל",
  member: "חבר",
};

// ---------------------------------------------------------------------------

export function Settings() {
  const [tab, setTab] = useState<Tab>("organization");

  return (
    <ScreenScaffold narrow title="הגדרות" subtitle="פרופיל, ניהול קבוצה, שיתופים והתראות.">
      <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-4">
        <nav className="card p-2 h-max sticky top-20">
          <ul className="space-y-0.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.key === tab;
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      active ? "bg-primary-50 text-primary-800 font-medium" : "text-ink-700 hover:bg-ink-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {tab === "profile"       && <Placeholder text="פרופיל — בקרוב" />}
          {tab === "organization"  && <OrgTab />}
          {tab === "sharing"       && <SharingTab />}
          {tab === "notifications" && <Placeholder text="התראות — בקרוב" />}
        </div>
      </div>
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------------------
// Organization tab
// ---------------------------------------------------------------------------

function OrgTab() {
  const { user, memberships, activeOrganizationId, setActiveOrganizationId } = useAuth();
  const { data: orgs = [] } = useUserOrganizations();
  const { data: org }       = useOrganization(activeOrganizationId);
  const { data: members = [] } = useOrgMembers();
  const { data: invites = [] } = useOrgInvites(activeOrganizationId);

  const updateOrg    = useUpdateOrganization();
  const createOrg    = useCreateOrganization();
  const deleteOrg    = useDeleteOrganization();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const removeMember = useRemoveMember();
  const updateRole   = useUpdateMemberRole();

  // Org selector
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<OrgType>("business");
  const [newOrgPassword, setNewOrgPassword] = useState("");

  // Org name editing
  const [editingName, setEditingName] = useState(false);
  const [orgName, setOrgName]         = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole, setInviteRole]     = useState<"member" | "admin">("member");
  const [lastInvite, setLastInvite]     = useState<{ token: string; email: string } | null>(null);
  const [copiedToken, setCopiedToken]   = useState<string | null>(null);

  // Delete org
  const [showDelete, setShowDelete]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Invite error
  const [inviteError, setInviteError]   = useState<string | null>(null);

  const myRole   = memberships.find(m => m.organization_id === activeOrganizationId)?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner   = myRole === "owner";

  // ---- Handlers ----

  const handleSaveName = async () => {
    if (!activeOrganizationId || !orgName.trim()) return;
    await updateOrg.mutateAsync({ orgId: activeOrganizationId, updates: { name: orgName.trim() } });
    setEditingName(false);
  };

  const handleTypeChange = async (t: OrgType) => {
    if (!activeOrganizationId) return;
    await updateOrg.mutateAsync({ orgId: activeOrganizationId, updates: { org_type: t } });
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const res = await createOrg.mutateAsync({ name: newOrgName.trim(), orgType: newOrgType, joinPassword: newOrgPassword || undefined });
    if (res.ok && res.organization_id) {
      setActiveOrganizationId(res.organization_id);
      setShowCreate(false);
      setNewOrgName(""); setNewOrgPassword("");
    }
  };

  const doInvite = async () => {
    if (!activeOrganizationId || !inviteEmail.trim()) return;
    setInviteError(null);
    try {
      const invite = await createInvite.mutateAsync({ orgId: activeOrganizationId, email: inviteEmail.trim(), role: inviteRole });
      setLastInvite({ token: invite.token, email: inviteEmail.trim() });
      setInviteEmail("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string } | null)?.message ?? String(err);
      setInviteError(msg || "שגיאה ביצירת ההזמנה — נסי שוב");
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDeleteOrg = async () => {
    if (!activeOrganizationId || deleteConfirm !== org?.name) return;
    await deleteOrg.mutateAsync(activeOrganizationId);
    const remaining = orgs.filter(o => o.id !== activeOrganizationId);
    setActiveOrganizationId(remaining[0]?.id ?? null);
    setShowDelete(false); setDeleteConfirm("");
  };

  // ---- Render ----

  return (
    <div className="space-y-4">

      {/* ── 1. בחירת קבוצה ───────────────────────────────────────────── */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900 text-sm">הקבוצות שלי</h2>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
          >
            <Plus className="w-3.5 h-3.5" />
            קבוצה חדשה
            {showCreate ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <div className="space-y-1">
          {orgs.map(o => {
            const Icon = ORG_TYPE_ICONS[o.org_type as OrgType] ?? Building2;
            const active = o.id === activeOrganizationId;
            return (
              <button
                key={o.id}
                onClick={() => setActiveOrganizationId(o.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-start",
                  active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-50"
                )}
              >
                <span className={cn("p-1 rounded-lg shrink-0", active ? "bg-white/15" : "bg-ink-100")}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 font-medium">{o.name}</span>
                <span className={cn("text-xs", active ? "text-white/60" : "text-ink-400")}>
                  {ORG_TYPE_LABELS[o.org_type as OrgType]}
                </span>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>

        {showCreate && (
          <form onSubmit={handleCreateOrg} className="border-t border-ink-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-ink-600">יצירת קבוצה חדשה</p>
            <input
              value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
              placeholder="שם הקבוצה" className="field text-sm w-full" autoFocus
            />
            <div className="grid grid-cols-3 gap-1">
              {(["business","family","personal"] as OrgType[]).map(t => {
                const Icon = ORG_TYPE_ICONS[t];
                return (
                  <button key={t} type="button" onClick={() => setNewOrgType(t)}
                    className={cn("flex flex-col items-center gap-1 py-2 rounded-xl text-xs border transition-colors",
                      newOrgType === t ? "border-primary-400 bg-primary-50 text-primary-700" : "border-ink-200 text-ink-600 hover:bg-ink-50"
                    )}>
                    <Icon className="w-4 h-4" />
                    {ORG_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
            {newOrgType !== "personal" && (
              <input value={newOrgPassword} onChange={e => setNewOrgPassword(e.target.value)}
                placeholder="סיסמת הצטרפות (אופציונלי)" className="field text-sm w-full" />
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={!newOrgName.trim() || createOrg.isPending}
                className="flex-1 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                {createOrg.isPending ? "יוצר..." : "צור קבוצה"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl border border-ink-200 text-sm text-ink-600 hover:bg-ink-50">
                ביטול
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── 2+3+4: Active org ────────────────────────────────────────── */}
      {org && (
        <>
          {/* ── 2. פרטי הקבוצה ─────────────────────────────────────── */}
          <section className="card p-4 space-y-4">
            <h2 className="font-semibold text-ink-900 text-sm">פרטי הקבוצה</h2>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-ink-500">שם הקבוצה</label>
              {editingName ? (
                <div className="flex gap-2">
                  <input value={orgName} onChange={e => setOrgName(e.target.value)}
                    className="field flex-1 text-sm" autoFocus
                    onKeyDown={e => e.key === "Enter" && handleSaveName()}
                  />
                  <button onClick={handleSaveName} disabled={updateOrg.isPending}
                    className="px-3 py-1.5 rounded-xl bg-primary-500 text-white text-sm hover:bg-primary-600 disabled:opacity-50">
                    שמור
                  </button>
                  <button onClick={() => setEditingName(false)}
                    className="px-3 py-1.5 rounded-xl border border-ink-200 text-sm text-ink-600 hover:bg-ink-50">
                    בטל
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-800">{org.name}</span>
                  {canManage && (
                    <button onClick={() => { setOrgName(org.name); setEditingName(true); }}
                      className="text-xs text-primary-600 hover:underline px-2 py-1">
                      ערוך שם
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Type */}
            {canManage && (
              <div className="space-y-1.5">
                <label className="text-xs text-ink-500">סוג קבוצה</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["business","family","personal"] as OrgType[]).map(t => {
                    const Icon = ORG_TYPE_ICONS[t];
                    return (
                      <button key={t} type="button" onClick={() => handleTypeChange(t)}
                        className={cn(
                          "flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs border transition-colors",
                          org.org_type === t
                            ? "border-primary-400 bg-primary-50 text-primary-700 font-medium"
                            : "border-ink-200 text-ink-600 hover:bg-ink-50"
                        )}>
                        <Icon className="w-4 h-4" />
                        {ORG_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── 3. חברים ───────────────────────────────────────────────── */}
          <section className="card overflow-hidden">
            <div className="p-4 pb-2 flex items-center justify-between">
              <h2 className="font-semibold text-ink-900 text-sm">חברים פעילים</h2>
              <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">{members.length}</span>
            </div>

            <div className="divide-y divide-ink-100">
              {members.map(m => {
                const isMe   = m.membership.user_id === user?.id;
                const name   = m.profile?.full_name ?? m.membership.user_id.slice(0, 8);
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <div key={m.membership.user_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-800 truncate">
                        {name}
                        {isMe && <span className="ms-1.5 text-xs text-ink-400 font-normal">(את/ה)</span>}
                      </div>
                    </div>
                    {canManage && !isMe ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={m.membership.role}
                          onChange={e => updateRole.mutate({ orgId: activeOrganizationId!, userId: m.membership.user_id, role: e.target.value as "owner"|"admin"|"member" })}
                          className="text-xs border border-ink-200 rounded-lg px-2 py-1 bg-white text-ink-700"
                        >
                          {["owner","admin","member"].map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { if (confirm(`להסיר את ${name} מהקבוצה?`)) removeMember.mutate({ orgId: activeOrganizationId!, userId: m.membership.user_id }); }}
                          className="p-1.5 rounded-lg text-ink-300 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                          title="הסר חבר"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                        m.membership.role === "owner" ? "bg-amber-100 text-amber-700" :
                        m.membership.role === "admin" ? "bg-blue-100 text-blue-700" :
                        "bg-ink-100 text-ink-500"
                      )}>
                        {ROLE_LABELS[m.membership.role]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 4. הזמנות ─────────────────────────────────────────────── */}
          {canManage && (
            <section className="card p-4 space-y-4">
              <h2 className="font-semibold text-ink-900 text-sm">הזמנות לקבוצה</h2>

              {/* Invite form */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError(null); }}
                    onKeyDown={e => e.key === "Enter" && doInvite()}
                    type="email"
                    placeholder="כתובת מייל של החבר/ה"
                    className="field flex-1 text-sm"
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as "member"|"admin")}
                    className="text-sm border border-ink-200 rounded-xl px-3 py-1.5 bg-white text-ink-700 shrink-0"
                  >
                    <option value="member">חבר</option>
                    <option value="admin">מנהל</option>
                  </select>
                  <button
                    type="button"
                    onClick={doInvite}
                    disabled={!inviteEmail.trim() || createInvite.isPending}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {createInvite.isPending ? "..." : "הזמן"}
                  </button>
                </div>
                {inviteError && (
                  <p className="text-xs text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{inviteError}</p>
                )}
              </div>

              {/* Last invite result — link + mailto */}
              {lastInvite && (
                <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-primary-700">
                    קישור הזמנה נוצר עבור {lastInvite.email}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-xs text-ink-600 bg-white rounded-lg px-2 py-1.5 border border-ink-200">
                      {`${window.location.origin}/invite/${lastInvite.token}`}
                    </code>
                    <button
                      onClick={() => copyLink(lastInvite.token)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-ink-200 text-xs text-ink-700 hover:bg-ink-50 transition-colors"
                    >
                      {copiedToken === lastInvite.token
                        ? <><Check className="w-3.5 h-3.5 text-green-600" /> הועתק</>
                        : <><Copy className="w-3.5 h-3.5" /> העתק</>
                      }
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`mailto:${lastInvite.email}?subject=${encodeURIComponent(`הוזמנת להצטרף לקבוצה ${org.name}`)}&body=${encodeURIComponent(`שלום,\n\nהוזמנת להצטרף לקבוצה "${org.name}" ב-Multitask.\n\nלחץ/י על הקישור הבא:\n${window.location.origin}/invite/${lastInvite.token}`)}`}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 transition-colors"
                    >
                      <Mail className="w-3 h-3" /> שלח במייל
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`הוזמנת להצטרף לקבוצה "${org.name}" ב-Multitask:\n${window.location.origin}/invite/${lastInvite.token}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" /> שלח בוואטסאפ
                    </a>
                  </div>
                </div>
              )}

              {/* Invites table */}
              {invites.length > 0 ? (
                <div className="rounded-xl border border-ink-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50 border-b border-ink-200">
                        <th className="text-start px-3 py-2 text-xs font-medium text-ink-500">מייל</th>
                        <th className="text-start px-3 py-2 text-xs font-medium text-ink-500">תפקיד</th>
                        <th className="text-start px-3 py-2 text-xs font-medium text-ink-500">סטטוס</th>
                        <th className="text-start px-3 py-2 text-xs font-medium text-ink-500">תאריך</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {invites.map(inv => {
                        const now = new Date();
                        const isAccepted = !!inv.accepted_at;
                        const isDeclined = !!inv.declined_at;
                        const isExpired = !isAccepted && !isDeclined && new Date(inv.expires_at) < now;
                        const isPending = !isAccepted && !isDeclined && !isExpired;
                        return (
                          <tr key={inv.id} className="hover:bg-ink-50 transition-colors">
                            <td className="px-3 py-2.5 text-ink-700 font-medium">{inv.email}</td>
                            <td className="px-3 py-2.5">
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                inv.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-ink-100 text-ink-500"
                              )}>
                                {ROLE_LABELS[inv.role]}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {isAccepted && (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                  <Check className="w-3 h-3" /> התקבל
                                </span>
                              )}
                              {isDeclined && (
                                <span className="flex items-center gap-1 text-xs text-danger-500 font-medium">
                                  <AlertCircle className="w-3 h-3" /> נדחה
                                </span>
                              )}
                              {isExpired && (
                                <span className="flex items-center gap-1 text-xs text-ink-400">
                                  <Clock className="w-3 h-3" /> פג תוקף
                                </span>
                              )}
                              {isPending && (
                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  ממתין
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-ink-400">
                              {new Date(inv.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => copyLink(inv.token)}
                                      className="p-1.5 rounded-lg text-ink-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                      title="העתק קישור"
                                    >
                                      {copiedToken === inv.token
                                        ? <Check className="w-3.5 h-3.5 text-green-600" />
                                        : <Copy className="w-3.5 h-3.5" />
                                      }
                                    </button>
                                    <a
                                      href={`https://wa.me/?text=${encodeURIComponent(`הוזמנת להצטרף לקבוצה "${org?.name}" ב-Multitask:\n${window.location.origin}/invite/${inv.token}`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg text-green-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                                      title="שתף בוואטסאפ"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                      onClick={() => revokeInvite.mutate({ inviteId: inv.id, orgId: activeOrganizationId! })}
                                      className="p-1.5 rounded-lg text-ink-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                                      title="בטל הזמנה"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-ink-400 text-center py-3">לא נשלחו הזמנות עדיין</p>
              )}
            </section>
          )}

          {/* ── 5. אזור מסוכן ────────────────────────────────────────── */}
          {isOwner && (
            <section className="card p-4 border border-danger-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-danger-600" />
                <h2 className="font-semibold text-danger-700 text-sm">אזור מסוכן</h2>
              </div>
              {!showDelete ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-800">מחיקת הקבוצה</p>
                    <p className="text-xs text-ink-500 mt-0.5">פעולה בלתי הפיכה — תמחק את כל החברים, ההזמנות והנתונים.</p>
                  </div>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-danger-300 text-sm text-danger-600 hover:bg-danger-50 transition-colors shrink-0 ms-4"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    מחק קבוצה
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-ink-700">
                    הקלד/י את שם הקבוצה כדי לאשר: <strong>{org.name}</strong>
                  </p>
                  <input
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder={org.name}
                    className="field text-sm w-full"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteOrg}
                      disabled={deleteConfirm !== org.name || deleteOrg.isPending}
                      className="flex-1 py-2 rounded-xl bg-danger-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deleteOrg.isPending ? "מוחק..." : "מחק לצמיתות"}
                    </button>
                    <button
                      onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                      className="px-4 py-2 rounded-xl border border-ink-200 text-sm text-ink-600 hover:bg-ink-50"
                    >
                      בטל
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sharing tab
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בביצוע",
  pending_approval: "ממתין לאישור",
  waiting_approval: "ממתין לאישור",
  done: "הושלם",
  cancelled: "בוטל",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-ink-100 text-ink-500",
  in_progress: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  waiting_approval: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-ink-100 text-ink-400",
};

function SharingTab() {
  const { user } = useAuth();
  const { data: allTasks = [] } = useTasks();
  const { data: members = [] } = useOrgMembers();

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach(({ membership, profile }) => {
      m.set(membership.user_id, profile?.full_name ?? `משתמש ${membership.user_id.slice(0, 6)}`);
    });
    return m;
  }, [members]);

  const userId = user?.id ?? "";

  const activeDelegated = allTasks.filter(
    t => t.owner_id === userId &&
      t.assignee_user_id &&
      t.assignee_user_id !== userId &&
      t.status !== "done" && t.status !== "cancelled"
  );

  const activeAssignedToMe = allTasks.filter(
    t => t.assignee_user_id === userId &&
      t.owner_id !== userId &&
      t.status !== "done" && t.status !== "cancelled"
  );

  const awaitingMyApproval = allTasks.filter(
    t => t.approver_user_id === userId &&
      (t.status === "pending_approval" || t.status === "waiting_approval")
  );

  const delegatedByPerson = useMemo(() => {
    const map = new Map<string, typeof activeDelegated>();
    activeDelegated.forEach(t => {
      const key = t.assignee_user_id!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [activeDelegated]);

  const assignedByPerson = useMemo(() => {
    const map = new Map<string, typeof activeAssignedToMe>();
    activeAssignedToMe.forEach(t => {
      const key = t.owner_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [activeAssignedToMe]);

  const hasAnything = activeDelegated.length > 0 || activeAssignedToMe.length > 0 || awaitingMyApproval.length > 0;

  if (!hasAnything) {
    return (
      <div className="card p-8 text-center space-y-2">
        <Users className="w-8 h-8 text-ink-300 mx-auto" />
        <p className="text-sm font-medium text-ink-600">אין שיתופים פעילים</p>
        <p className="text-xs text-ink-400">
          כשתאצילי משימות לאחרים או שיואצלו לך, הן יופיעו כאן.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── משימות שהאצלתי ─────────────────────────────────────────── */}
      {activeDelegated.length > 0 && (
        <section className="card overflow-hidden">
          <div className="p-4 pb-2 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-ink-900 text-sm">האצלתי לאחרים</h2>
            <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full ms-auto">{activeDelegated.length}</span>
          </div>
          {Array.from(delegatedByPerson.entries()).map(([assigneeId, tasks]) => (
            <div key={assigneeId} className="border-t border-ink-100">
              <div className="px-4 py-2 bg-ink-50 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  {(nameMap.get(assigneeId) ?? "?")[0].toUpperCase()}
                </div>
                <span className="text-xs font-medium text-ink-700">{nameMap.get(assigneeId) ?? assigneeId}</span>
                <span className="text-xs text-ink-400 ms-auto">{tasks.length} משימות</span>
              </div>
              <div className="divide-y divide-ink-50">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm text-ink-700 truncate">{t.title}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0", STATUS_COLORS[t.status] ?? STATUS_COLORS.todo)}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── הוקצו לי ───────────────────────────────────────────────── */}
      {activeAssignedToMe.length > 0 && (
        <section className="card overflow-hidden">
          <div className="p-4 pb-2 flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-ink-900 text-sm">הוקצו לי</h2>
            <span className="text-xs text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full ms-auto">{activeAssignedToMe.length}</span>
          </div>
          {Array.from(assignedByPerson.entries()).map(([ownerId, tasks]) => (
            <div key={ownerId} className="border-t border-ink-100">
              <div className="px-4 py-2 bg-ink-50 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  {(nameMap.get(ownerId) ?? "?")[0].toUpperCase()}
                </div>
                <span className="text-xs font-medium text-ink-700">{nameMap.get(ownerId) ?? ownerId}</span>
                <span className="text-xs text-ink-400 ms-auto">{tasks.length} משימות</span>
              </div>
              <div className="divide-y divide-ink-50">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm text-ink-700 truncate">{t.title}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0", STATUS_COLORS[t.status] ?? STATUS_COLORS.todo)}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── ממתינות לאישורי ────────────────────────────────────────── */}
      {awaitingMyApproval.length > 0 && (
        <section className="card overflow-hidden">
          <div className="p-4 pb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-ink-900 text-sm">ממתינות לאישורי</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ms-auto">{awaitingMyApproval.length}</span>
          </div>
          <div className="divide-y divide-ink-100">
            {awaitingMyApproval.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-ink-300 shrink-0" />
                <span className="flex-1 text-sm text-ink-700 truncate">{t.title}</span>
                <span className="text-xs text-ink-400">{nameMap.get(t.owner_id) ?? ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------

function Placeholder({ text }: { text: string }) {
  return <div className="card p-6 text-center text-sm text-ink-500">{text}</div>;
}
