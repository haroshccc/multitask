import { useState } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import {
  useTaskListShares,
  useSetTaskListShare,
  useRemoveTaskListShare,
} from "@/lib/hooks/useTaskLists";
import { useAuth } from "@/lib/auth/AuthContext";
import type { TaskList } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";

interface ShareListModalProps {
  list: TaskList;
  onClose: () => void;
}

/**
 * Explicit share roster for a list.
 * "עריכה" = description + timer only (no title/status/urgency changes).
 * "צפייה" = read-only, no mutations.
 */
export function ShareListModal({ list, onClose }: ShareListModalProps) {
  const { user } = useAuth();
  const { data: members = [] } = useOrgMembers();
  const { data: shares = [] } = useTaskListShares(list.id);
  const setShare = useSetTaskListShare();
  const removeShare = useRemoveTaskListShare();

  const shareByUser = new Map(shares.map((s) => [s.user_id, s.permission]));

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
            <h3 className="font-semibold text-ink-900">שיתוף וסנכרון</h3>
            <p className="text-xs text-ink-500">
              רשימה: {list.emoji ? `${list.emoji} ` : ""}
              {list.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-4 space-y-1 flex-1 overflow-y-auto min-h-0">
          <p className="text-xs text-ink-500 mb-3 leading-relaxed">
            הרשימה פרטית שלך. שתף עם משתמשים ספציפיים מהקבוצה.
            <strong> עריכה</strong> = תיאור + סטופר בלבד.
            <strong> צפייה</strong> = קריאה בלבד, ללא שינויים.
          </p>
          {members.length === 0 && (
            <p className="text-sm text-ink-500 text-center py-6">
              אין חברים אחרים בארגון.
            </p>
          )}
          {members.map(({ membership, profile }) => {
            const isSelf = membership.user_id === user?.id;
            const currentPerm = shareByUser.get(membership.user_id);
            const name = profile?.full_name ?? profile?.id ?? membership.user_id;
            return (
              <MemberRow
                key={membership.user_id}
                name={name}
                role={membership.role ?? null}
                avatar={profile?.avatar_url ?? null}
                isSelf={isSelf}
                currentPermission={currentPerm ?? null}
                onToggle={(next) => {
                  const prev = currentPerm ?? null;
                  const userId = membership.user_id;
                  const listId = list.id;
                  const apply = (perm: typeof next) => {
                    if (perm === null) {
                      removeShare.mutate({ listId, userId });
                    } else {
                      setShare.mutate({ listId, userId, permission: perm });
                    }
                  };
                  apply(next);
                  pushUndo({
                    description: next === null
                      ? "ביטול שיתוף רשימה"
                      : "שיתוף רשימה",
                    undo: () => apply(prev),
                    redo: () => apply(next),
                  });
                }}
              />
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

function MemberRow({
  name,
  role,
  avatar,
  isSelf,
  currentPermission,
  onToggle,
}: {
  name: string;
  role: string | null;
  avatar: string | null;
  isSelf: boolean;
  currentPermission: "read" | "write" | null;
  onToggle: (next: "read" | "write" | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const chipLabel =
    currentPermission === "write"
      ? "עריכה"
      : currentPermission === "read"
      ? "צפייה"
      : "ללא שיתוף מפורש";

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-50">
      <div className="w-8 h-8 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center text-sm font-medium shrink-0 overflow-hidden">
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          (name[0] ?? "?").toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-900 truncate">
          {name}
          {isSelf && <span className="text-xs text-ink-400 ms-1">(את)</span>}
        </div>
        {role && (
          <div className="text-xs text-ink-500 truncate">{role}</div>
        )}
      </div>
      {!isSelf && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
            className={cn(
              "text-xs rounded-lg px-2.5 py-1 border",
              currentPermission
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-ink-200 text-ink-600 hover:bg-ink-100"
            )}
          >
            {chipLabel}
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute end-0 bottom-full mb-1 w-40 bg-white border border-ink-200 rounded-xl shadow-lift z-20 py-1 text-sm">
                <PermItem
                  label="עריכה"
                  active={currentPermission === "write"}
                  onClick={() => {
                    onToggle("write");
                    setMenuOpen(false);
                  }}
                />
                <PermItem
                  label="צפייה בלבד"
                  active={currentPermission === "read"}
                  onClick={() => {
                    onToggle("read");
                    setMenuOpen(false);
                  }}
                />
                <PermItem
                  label="ללא שיתוף מפורש"
                  active={!currentPermission}
                  onClick={() => {
                    onToggle(null);
                    setMenuOpen(false);
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PermItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-ink-100",
        active && "text-primary-800 bg-primary-50"
      )}
    >
      <span>{label}</span>
      {active && <Check className="w-3.5 h-3.5" />}
    </button>
  );
}
