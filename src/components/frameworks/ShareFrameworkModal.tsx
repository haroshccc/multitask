import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import {
  useFrameworkShares,
  useAddFrameworkShare,
  useRemoveFrameworkShare,
} from "@/lib/hooks/useFrameworks";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Framework } from "@/lib/types/frameworks";

interface Props {
  framework: Framework;
  onClose: () => void;
}

/**
 * View-only sharing for an entire framework. Recipients can see (not edit) the
 * framework and toggle it on/off on their own calendar.
 */
export function ShareFrameworkModal({ framework, onClose }: Props) {
  const { user } = useAuth();
  const { data: members = [] } = useOrgMembers();
  const { data: shares = [] } = useFrameworkShares(framework.id);
  const addShare = useAddFrameworkShare();
  const removeShare = useRemoveFrameworkShare();

  const sharedSet = new Set(shares.map((s) => s.user_id));

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-lg flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-ink-900">שיתוף מסגרת</h3>
            <p className="text-xs text-ink-500">
              {framework.emoji ? `${framework.emoji} ` : ""}
              {framework.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-4 space-y-1 flex-1 overflow-y-auto min-h-0">
          <p className="text-xs text-ink-500 mb-3 leading-relaxed">
            שיתוף מסגרת הוא <strong>צפייה בלבד</strong> — מי שמשתפים איתו יראה את
            המסגרת ביומן שלו ויוכל להדליק/לכבות אותה, אך לא לערוך.
          </p>
          {members.length === 0 && (
            <p className="text-sm text-ink-500 text-center py-6">אין חברים אחרים בארגון.</p>
          )}
          {members.map(({ membership, profile }) => {
            const isSelf = membership.user_id === user?.id;
            if (isSelf) return null;
            const isShared = sharedSet.has(membership.user_id);
            const name = profile?.full_name ?? profile?.id ?? membership.user_id;
            return (
              <div
                key={membership.user_id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-50"
              >
                <div className="w-8 h-8 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center text-sm font-medium shrink-0 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (name[0] ?? "?").toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{name}</div>
                  {membership.role && (
                    <div className="text-xs text-ink-500 truncate">{membership.role}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    isShared
                      ? removeShare.mutate({ frameworkId: framework.id, userId: membership.user_id })
                      : addShare.mutate({ frameworkId: framework.id, userId: membership.user_id })
                  }
                  className={cn(
                    "text-xs rounded-lg px-2.5 py-1 border inline-flex items-center gap-1.5",
                    isShared
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-ink-200 text-ink-600 hover:bg-ink-100"
                  )}
                >
                  {isShared && <Check className="w-3.5 h-3.5" />}
                  {isShared ? "משותף (צפייה)" : "שתף"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-ink-200 flex items-center justify-end shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
