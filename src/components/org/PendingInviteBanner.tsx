import { useMyPendingInvites, useAcceptInvite, useRevokeInvite } from "@/lib/hooks/useOrganizations";
import { useAuth } from "@/lib/auth/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, X, Check } from "lucide-react";

export function PendingInviteBanner() {
  const { user, setActiveOrganizationId } = useAuth();
  const { data: invites = [] } = useMyPendingInvites();
  const acceptInvite = useAcceptInvite();
  const revokeInvite = useRevokeInvite();
  const qc = useQueryClient();

  if (!user || invites.length === 0) return null;

  return (
    <div className="border-t border-amber-200 bg-amber-50">
      {invites.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center gap-3 px-4 md:px-6 py-2 text-sm"
        >
          <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="flex-1 text-ink-800 text-xs">
            הוזמנת להצטרף לקבוצה <strong>{inv.org_name}</strong>
          </span>
          <button
            onClick={async () => {
              const res = await acceptInvite.mutateAsync(inv.token);
              if (res.ok && res.organization_id) {
                setActiveOrganizationId(res.organization_id);
                qc.invalidateQueries({ queryKey: ["my-pending-invites"] });
              }
            }}
            disabled={acceptInvite.isPending}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 disabled:opacity-50 shrink-0"
          >
            <Check className="w-3 h-3" />
            הצטרף
          </button>
          <button
            onClick={() =>
              revokeInvite.mutate({ inviteId: inv.id, orgId: inv.organization_id })
            }
            className="p-1 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
            title="דחה הזמנה"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
