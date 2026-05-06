import { useState } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import {
  User, Building2, Users, Bell, Trash2, Mail, Copy, Check,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
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
  { key: "profile",       label: "פרופיל",   icon: User },
  { key: "organization",  label: "ניהול קבוצה", icon: Building2 },
  { key: "sharing",       label: "שיתופים",  icon: Users },
  { key: "notifications", label: "התראות",   icon: Bell },
];

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  business: "עסקי",
  family:   "משפחה",
  personal: "אישי",
};

const ROLE_LABELS: Record<string, string> = {
  owner:  "בעלים",
  admin:  "מנהל",
  member: "חבר",
};

export function Settings() {
  const [tab, setTab] = useState<Tab>("organization");

  return (
    <ScreenScaffold
      narrow
      title="הגדרות"
      subtitle="פרופיל, ניהול קבוצה, שיתופים והתראות."
    >
      <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4">
        <nav className="card p-2 h-max">
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
                      active
                        ? "bg-primary-50 text-primary-800 font-medium"
                        : "text-ink-700 hover:bg-ink-100"
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

        <div>
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
  const { data: org } = useOrganization(activeOrganizationId);
  const { data: members = [] } = useOrgMembers();
  const { data: invites = [] } = useOrgInvites(activeOrganizationId);

  const updateOrg    = useUpdateOrganization();
  const createOrg    = useCreateOrganization();
  const deleteOrg    = useDeleteOrganization();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const removeMember = useRemoveMember();
  const updateRole   = useUpdateMemberRole();

  const [orgName, setOrgName]         = useState("");
  const [editingName, setEditingName] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"member" | "admin">("member");
  const [inviteSent, setInviteSent]   = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newOrgName, setNewOrgName]   = useState("");
  const [newOrgType, setNewOrgType]   = useState<OrgType>("business");
  const [newOrgPassword, setNewOrgPassword] = useState("");
  const [showCreate, setShowCreate]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete]   = useState(false);

  const myRole = memberships.find(m => m.organization_id === activeOrganizationId)?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const handleSaveName = async () => {
    if (!activeOrganizationId || !orgName.trim()) return;
    await updateOrg.mutateAsync({ orgId: activeOrganizationId, updates: { name: orgName.trim() } });
    setEditingName(false);
  };

  const handleTypeChange = async (t: OrgType) => {
    if (!activeOrganizationId) return;
    await updateOrg.mutateAsync({ orgId: activeOrganizationId, updates: { org_type: t } });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganizationId || !inviteEmail.trim()) return;
    const invite = await createInvite.mutateAsync({ orgId: activeOrganizationId, email: inviteEmail.trim(), role: inviteRole });
    setInviteSent(invite.token);
    setInviteEmail("");
  };

  const handleDeleteOrg = async () => {
    if (!activeOrganizationId || deleteConfirm !== org?.name) return;
    await deleteOrg.mutateAsync(activeOrganizationId);
    const remaining = orgs.filter(o => o.id !== activeOrganizationId);
    setActiveOrganizationId(remaining[0]?.id ?? null);
    setShowDelete(false);
    setDeleteConfirm("");
  };

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
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

  return (
    <div className="space-y-4">
      {/* Org switcher strip */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">הקבוצות שלי</h2>
          <button onClick={() => setShowCreate(v => !v)} className="text-sm text-primary-600 hover:underline">
            + קבוצה חדשה
          </button>
        </div>
        <div className="space-y-1">
          {orgs.map(o => (
            <button
              key={o.id}
              onClick={() => setActiveOrganizationId(o.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-start",
                o.id === activeOrganizationId
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:bg-ink-50"
              )}
            >
              <span className="flex-1 font-medium">{o.name}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", o.id === activeOrganizationId ? "bg-white/20" : "bg-ink-100 text-ink-500")}>
                {ORG_TYPE_LABELS[o.org_type as OrgType]}
              </span>
              {o.id === activeOrganizationId && <Check className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>

        {showCreate && (
          <form onSubmit={handleCreateOrg} className="border-t border-ink-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-ink-500">יצירת קבוצה חדשה</p>
            <input
              value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
              placeholder="שם הקבוצה" className="field text-sm" autoFocus
            />
            <div className="grid grid-cols-3 gap-1">
              {(["business","family","personal"] as OrgType[]).map(t => (
                <button key={t} type="button" onClick={() => setNewOrgType(t)}
                  className={cn("py-1.5 rounded-lg text-xs border transition-colors",
                    newOrgType === t ? "border-primary-400 bg-primary-50 text-primary-700" : "border-ink-200 text-ink-600 hover:bg-ink-50"
                  )}>
                  {ORG_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {newOrgType !== "personal" && (
              <input value={newOrgPassword} onChange={e => setNewOrgPassword(e.target.value)}
                placeholder="סיסמת הצטרפות (אופציונלי)" className="field text-sm" />
            )}
            <button type="submit" disabled={!newOrgName.trim() || createOrg.isPending}
              className="w-full py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
              {createOrg.isPending ? "יוצר..." : "צור קבוצה"}
            </button>
          </form>
        )}
      </div>

      {/* Active org settings */}
      {org && (
        <>
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-ink-900">הגדרות — {org.name}</h2>

            {/* Name */}
            <div>
              <label className="text-xs text-ink-500 mb-1 block">שם</label>
              {editingName ? (
                <div className="flex gap-2">
                  <input value={orgName} onChange={e => setOrgName(e.target.value)}
                    className="field flex-1 text-sm" autoFocus />
                  <button onClick={handleSaveName} className="btn-primary text-sm px-3 py-1.5">שמור</button>
                  <button onClick={() => setEditingName(false)} className="btn-ghost text-sm px-3 py-1.5">בטל</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-800">{org.name}</span>
                  {canManage && (
                    <button onClick={() => { setOrgName(org.name); setEditingName(true); }}
                      className="text-xs text-primary-600 hover:underline">ערוך</button>
                  )}
                </div>
              )}
            </div>

            {/* Type */}
            {canManage && (
              <div>
                <label className="text-xs text-ink-500 mb-1 block">סוג</label>
                <div className="flex gap-2">
                  {(["business","family","personal"] as OrgType[]).map(t => (
                    <button key={t} type="button" onClick={() => handleTypeChange(t)}
                      className={cn("flex-1 py-1.5 rounded-xl text-sm border transition-colors",
                        org.org_type === t ? "border-primary-400 bg-primary-50 text-primary-700 font-medium" : "border-ink-200 text-ink-600 hover:bg-ink-50"
                      )}>
                      {ORG_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delete org */}
            {isOwner && (
              <div className="border-t border-ink-100 pt-3">
                {!showDelete ? (
                  <button
                    onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1.5 text-sm text-danger-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    מחק קבוצה
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-danger-700 font-medium">
                      פעולה זו תמחק את הקבוצה לצמיתות כולל כל החברים וההזמנות.
                    </p>
                    <p className="text-xs text-ink-500">הקלד/י את שם הקבוצה לאישור: <strong>{org.name}</strong></p>
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
                        className="flex-1 py-1.5 rounded-xl bg-danger-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40"
                      >
                        {deleteOrg.isPending ? "מוחק..." : "מחק לצמיתות"}
                      </button>
                      <button
                        onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                        className="px-4 py-1.5 rounded-xl border border-ink-200 text-sm text-ink-600 hover:bg-ink-50"
                      >
                        בטל
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-ink-900">חברים ({members.length})</h2>
            <div className="space-y-1">
              {members.map(m => {
                const isMe = m.membership.user_id === user?.id;
                const name = m.profile?.full_name ?? m.membership.user_id.slice(0,8);
                return (
                  <div key={m.membership.user_id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-ink-50">
                    <div className="w-7 h-7 rounded-full bg-ink-200 flex items-center justify-center text-xs font-medium text-ink-700 shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-800 truncate">{name}{isMe && " (את/ה)"}</div>
                      {m.profile?.avatar_url === null && m.profile?.full_name === null && (
                        <div className="text-xs text-ink-400">{m.membership.user_id}</div>
                      )}
                    </div>
                    {canManage && !isMe ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={m.membership.role}
                          onChange={e => updateRole.mutate({ orgId: activeOrganizationId!, userId: m.membership.user_id, role: e.target.value as "owner"|"admin"|"member" })}
                          className="text-xs border border-ink-200 rounded-lg px-2 py-1 bg-white"
                        >
                          {["owner","admin","member"].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <button
                          onClick={() => { if (confirm(`להסיר את ${name}?`)) removeMember.mutate({ orgId: activeOrganizationId!, userId: m.membership.user_id }); }}
                          className="p-1 rounded-lg text-ink-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">{ROLE_LABELS[m.membership.role]}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Invite by email */}
            {canManage && (
              <div className="border-t border-ink-100 pt-3 space-y-2">
                <div>
                  <p className="text-xs font-medium text-ink-500">הזמן חבר/ה לקבוצה</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    מייל אוטומטי לא נשלח — צור/י קישור הזמנה ושלח/י אותו ידנית.
                  </p>
                </div>
                <form onSubmit={handleInvite} className="flex gap-2">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    type="email" placeholder="כתובת מייל" className="field flex-1 text-sm" />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "member"|"admin")}
                    className="text-sm border border-ink-200 rounded-xl px-2 py-1.5 bg-white">
                    <option value="member">חבר</option>
                    <option value="admin">מנהל</option>
                  </select>
                  <button type="submit" disabled={!inviteEmail.trim() || createInvite.isPending}
                    className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1 shrink-0">
                    <Mail className="w-3.5 h-3.5" /> צור קישור
                  </button>
                </form>
                {inviteSent && (
                  <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 space-y-1.5">
                    <p className="text-xs font-medium text-primary-700">קישור ההזמנה מוכן — שלח/י אותו לחבר/ה:</p>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-xs text-ink-600 font-mono bg-white rounded-lg px-2 py-1 border border-ink-200">
                        {`${window.location.origin}/invite/${inviteSent}`}
                      </span>
                      <button onClick={() => copyInviteLink(inviteSent)} className="shrink-0 p-1.5 rounded-lg text-primary-600 hover:bg-primary-100">
                        {copiedToken === inviteSent ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <a
                      href={`mailto:${inviteEmail || ""}?subject=הוזמנת להצטרף לקבוצה ${org?.name ?? ""}&body=${encodeURIComponent(`שלום,\n\nהוזמנת להצטרף לקבוצה "${org?.name ?? ""}" ב-Multitask.\n\nלחץ/י על הקישור הבא כדי להצטרף:\n${window.location.origin}/invite/${inviteSent}`)}`}
                      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                    >
                      <Mail className="w-3 h-3" /> פתח מייל מוכן לשליחה
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Pending invites */}
            {canManage && invites.length > 0 && (
              <div className="border-t border-ink-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-ink-500">הזמנות ממתינות ({invites.length})</p>
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                    <span className="flex-1 text-ink-700">{inv.email}</span>
                    <span className="text-xs text-ink-400">{ROLE_LABELS[inv.role]}</span>
                    <button
                      onClick={() => { if (confirm("לבטל הזמנה?")) revokeInvite.mutate({ inviteId: inv.id, orgId: activeOrganizationId! }); }}
                      className="p-1 rounded-lg text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => copyInviteLink(inv.token)} className="p-1 rounded-lg text-ink-400 hover:text-primary-600 hover:bg-primary-50">
                      {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sharing tab
// ---------------------------------------------------------------------------

function SharingTab() {
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="font-semibold text-ink-900 mb-2">שיתופים פעילים</h2>
        <p className="text-sm text-ink-500">
          ניהול שיתופים מפורט — בקרוב. בינתיים, ניתן לשתף רשימות משימות מתוך מסך המשימות (לחיצה על ⋯ ברשימה).
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

function Placeholder({ text }: { text: string }) {
  return <div className="card p-6 text-center text-sm text-ink-500">{text}</div>;
}
