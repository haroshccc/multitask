import { useMemo } from "react";
import { X, Check, UserPlus, Users } from "lucide-react";
import {
  useMealPlanShares,
  useCreateMealPlanShare,
  useDeleteMealPlanShare,
} from "@/lib/hooks/useFood";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import { useOrganization } from "@/lib/hooks/useOrganizations";

interface ShareMenuModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal listing every other member of the org with a toggle controlling
 * whether the current user has granted them access to their meal plans.
 *
 * Two visual sections:
 *   • "אני משתפת עם" — outgoing grants (toggleable)
 *   • "משתפים איתי" — incoming grants, read-only here (the recipient
 *     can leave a share via the trash button)
 */
export function ShareMenuModal({ open, onClose }: ShareMenuModalProps) {
  const scope = useOrgScope();
  const { data: org } = useOrganization(scope.organizationId ?? null);
  const { data: members = [] } = useOrgMembers();
  const { data: shares = [] } = useMealPlanShares();
  const createShare = useCreateMealPlanShare();
  const deleteShare = useDeleteMealPlanShare();

  const isFoodOrgShared = (org?.food_shared ?? false) || org?.org_type === "family";

  const otherMembers = useMemo(
    () => members.filter((m) => m.profile && m.profile.id !== scope.userId),
    [members, scope.userId]
  );

  const outgoing = useMemo(
    () => new Set(
      shares
        .filter((s) => s.sharer_user_id === scope.userId)
        .map((s) => s.shared_with_user_id)
    ),
    [shares, scope.userId]
  );

  const incoming = useMemo(
    () =>
      shares
        .filter((s) => s.shared_with_user_id === scope.userId)
        .map((s) => s.sharer_user_id),
    [shares, scope.userId]
  );

  if (!open) return null;

  const handleToggleOutgoing = async (otherUserId: string) => {
    if (outgoing.has(otherUserId)) {
      await deleteShare.mutateAsync({
        sharerUserId: scope.userId!,
        sharedWithUserId: otherUserId,
      });
    } else {
      await createShare.mutateAsync(otherUserId);
    }
  };

  const handleLeaveIncoming = async (sharerUserId: string) => {
    if (!scope.userId) return;
    await deleteShare.mutateAsync({
      sharerUserId,
      sharedWithUserId: scope.userId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-ink-100">
          <h2 className="text-lg font-semibold text-ink-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            שיתוף תפריט
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 space-y-5">
          {/* Org-level food sharing banner */}
          {isFoodOrgShared && (
            <div className="flex items-start gap-2.5 rounded-lg bg-primary-50 border border-primary-200 p-3">
              <Users className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
              <div className="text-xs text-primary-800 space-y-0.5">
                <div className="font-semibold">שיתוף קבוצתי פעיל</div>
                <div>
                  {org?.org_type === "family"
                    ? "קבוצות משפחה משתפות מזון אוטומטית — כל חברי הקבוצה רואים ויכולים לערוך את אותן המנות, המצרכים והתפריטים."
                    : "שיתוף מזון פעיל עבור קבוצה זו — כל חברי הקבוצה רואים ויכולים לערוך את אותן המנות, המצרכים והתפריטים. ניתן לבטל זאת בהגדרות הקבוצה."}
                </div>
              </div>
            </div>
          )}

          <section>
            <h3 className="text-sm font-medium text-ink-900 mb-2">
              אני משתפת את התפריט שלי עם:
            </h3>
            <p className="text-xs text-ink-500 mb-3">
              מי שתסמני יוכל לראות את התפריט השבועי ותפריטי הימים שלך, וגם לערוך אותם.
            </p>
            {otherMembers.length === 0 ? (
              <div className="text-xs text-ink-400 px-3 py-2">
                אין חברים אחרים בארגון. הוסיפי בני משפחה ב"הגדרות → חברי ארגון".
              </div>
            ) : (
              <ul className="space-y-1">
                {otherMembers.map((m) => {
                  const uid = m.profile!.id;
                  const isShared = outgoing.has(uid);
                  return (
                    <li key={uid}>
                      <button
                        type="button"
                        onClick={() => handleToggleOutgoing(uid)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-ink-50 text-start"
                      >
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                            isShared
                              ? "bg-ink-900 border-ink-900 text-white"
                              : "border-ink-300 bg-white"
                          }`}
                        >
                          {isShared && <Check className="w-3 h-3" />}
                        </span>
                        <span className="text-sm text-ink-900 flex-1 truncate">
                          {m.profile!.full_name?.trim() || "(ללא שם)"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-ink-900 mb-2">
              משתפים איתי:
            </h3>
            {incoming.length === 0 ? (
              <p className="text-xs text-ink-400 px-3 py-2">
                אף אחד עוד לא שיתף איתך את התפריט שלו.
              </p>
            ) : (
              <ul className="space-y-1">
                {incoming.map((uid) => {
                  const m = members.find((x) => x.profile?.id === uid);
                  return (
                    <li
                      key={uid}
                      className="flex items-center gap-3 px-3 py-2 rounded-md bg-ink-50/60"
                    >
                      <span className="text-sm text-ink-900 flex-1 truncate">
                        {m?.profile?.full_name?.trim() || "(ללא שם)"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLeaveIncoming(uid)}
                        className="text-xs text-ink-500 hover:text-danger-600"
                        title="הפסק לקבל גישה"
                      >
                        עזיבה
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-dark">
            סיימתי
          </button>
        </footer>
      </div>
    </div>
  );
}
