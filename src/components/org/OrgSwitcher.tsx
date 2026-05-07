import { useState, useRef, useEffect } from "react";
import { Building2, Users, User, ChevronDown, Plus, Check } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUserOrganizations, useCreateOrganization } from "@/lib/hooks/useOrganizations";
import { cn } from "@/lib/utils/cn";
import type { OrgType } from "@/lib/services/organizations";

const ORG_TYPE_ICONS: Record<OrgType, typeof Building2> = {
  business: Building2,
  family: Users,
  personal: User,
};

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  business: "עסקי",
  family: "משפחה",
  personal: "אישי",
};

const ORG_TYPE_COLORS: Record<OrgType, string> = {
  business: "bg-blue-100 text-blue-700",
  family: "bg-green-100 text-green-700",
  personal: "bg-purple-100 text-purple-700",
};

interface CreateOrgFormProps {
  onDone: () => void;
}

function CreateOrgForm({ onDone }: CreateOrgFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType>("business");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const createOrg = useCreateOrganization();
  const { setActiveOrganizationId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    const result = await createOrg.mutateAsync({
      name: name.trim(),
      orgType: type,
      joinPassword: type !== "personal" ? password : undefined,
    });
    if (result.ok && result.organization_id) {
      setActiveOrganizationId(result.organization_id);
      onDone();
    } else {
      const errCode = (result as { error?: string }).error ?? "";
      if (errCode === "name_taken") {
        setError("שם הקבוצה כבר תפוס. בחרי שם אחר.");
      } else {
        setError("אירעה שגיאה. נסי שוב.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-ink-100 space-y-2">
      <p className="text-xs font-medium text-ink-500">קבוצה חדשה</p>
      <input
        type="text"
        placeholder="שם הקבוצה..."
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        className="w-full text-sm px-3 py-1.5 rounded-lg border border-ink-200 focus:outline-none focus:border-primary-400"
        autoFocus
      />
      <div className="grid grid-cols-3 gap-1">
        {(["business", "family", "personal"] as OrgType[]).map((t) => {
          const Icon = ORG_TYPE_ICONS[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs border transition-colors",
                type === t
                  ? "border-primary-400 bg-primary-50 text-primary-700"
                  : "border-ink-200 text-ink-600 hover:bg-ink-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {ORG_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
      {type !== "personal" && (
        <input
          type="text"
          placeholder="סיסמת הצטרפות (אופציונלי)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full text-sm px-3 py-1.5 rounded-lg border border-ink-200 focus:outline-none focus:border-primary-400"
        />
      )}
      {error && (
        <p className="text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!name.trim() || createOrg.isPending}
        className="w-full py-1.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
      >
        {createOrg.isPending ? "יוצר..." : "צור קבוצה"}
      </button>
    </form>
  );
}

export function OrgSwitcher() {
  const { activeOrganizationId, setActiveOrganizationId } = useAuth();
  const { data: orgs = [] } = useUserOrganizations();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeOrg = orgs.find((o) => o.id === activeOrganizationId);
  const ActiveIcon = activeOrg ? ORG_TYPE_ICONS[activeOrg.org_type as OrgType] : Building2;

  if (orgs.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm transition-colors max-w-[160px]",
          open ? "bg-ink-100 text-ink-900" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        )}
      >
        <ActiveIcon className="w-4 h-4 shrink-0" />
        <span className="truncate">{activeOrg?.name ?? "בחר קבוצה"}</span>
        <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 start-0 w-60 bg-white rounded-2xl shadow-lift border border-ink-200 z-50 overflow-hidden">
          <div className="p-2 space-y-0.5">
            {orgs.map((org) => {
              const Icon = ORG_TYPE_ICONS[org.org_type as OrgType];
              const isActive = org.id === activeOrganizationId;
              return (
                <button
                  key={org.id}
                  onClick={() => {
                    setActiveOrganizationId(org.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-start transition-colors",
                    isActive ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-50"
                  )}
                >
                  <span
                    className={cn(
                      "p-1 rounded-lg text-xs",
                      isActive ? "bg-white/20 text-white" : ORG_TYPE_COLORS[org.org_type as OrgType]
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{org.name}</div>
                    <div className={cn("text-xs", isActive ? "text-white/70" : "text-ink-400")}>
                      {ORG_TYPE_LABELS[org.org_type as OrgType]}
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          {!showCreate ? (
            <div className="p-2 border-t border-ink-100">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-ink-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>קבוצה חדשה</span>
              </button>
            </div>
          ) : (
            <CreateOrgForm onDone={() => { setShowCreate(false); setOpen(false); }} />
          )}
        </div>
      )}
    </div>
  );
}
