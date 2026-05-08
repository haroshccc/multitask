import { useNavigate } from "react-router-dom";
import { Bell, Check, X, CheckCheck } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/hooks/useNotifications";
import { useUpdateTask } from "@/lib/hooks/useTasks";
import type { Notification } from "@/lib/types/domain";

export function Notifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const updateTask = useUpdateTask();
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleAcceptDelegation = async (n: Notification) => {
    const taskId = (n.payload as Record<string, unknown>)?.task_id as string | undefined;
    if (!taskId) return;
    await updateTask.mutateAsync({
      taskId,
      patch: { delegation_status: "accepted" } as never,
    });
    markRead.mutate(n.id);
  };

  const handleRejectDelegation = async (n: Notification) => {
    const taskId = (n.payload as Record<string, unknown>)?.task_id as string | undefined;
    if (!taskId) return;
    await updateTask.mutateAsync({
      taskId,
      patch: { delegation_status: "rejected", assignee_user_id: null } as never,
    });
    markRead.mutate(n.id);
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <ScreenScaffold
      title="התראות"
      subtitle="האצלות משימות, עדכוני אישורים ועוד."
      narrow
      actions={
        unreadCount > 0 ? (
          <button
            type="button"
            className="btn-ghost text-sm gap-1.5"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="w-4 h-4" />
            סמן הכל כנקרא
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="card p-6 text-center text-ink-500 text-sm">טוען…</div>
      ) : notifications.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-sm text-ink-500">אין התראות</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-ink-100">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onClick={() => handleNotificationClick(n)}
              onAccept={n.type === "task_assigned" && !n.read_at ? () => handleAcceptDelegation(n) : undefined}
              onReject={n.type === "task_assigned" && !n.read_at ? () => handleRejectDelegation(n) : undefined}
              isPending={updateTask.isPending}
            />
          ))}
        </div>
      )}
    </ScreenScaffold>
  );
}

function NotificationRow({
  notification: n,
  onClick,
  onAccept,
  onReject,
  isPending,
}: {
  notification: Notification;
  onClick: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  isPending?: boolean;
}) {
  const isUnread = !n.read_at;
  const payload = n.payload as Record<string, unknown>;
  const requiresApproval = payload?.requires_approval as boolean | undefined;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        isUnread ? "bg-primary-50/50" : "hover:bg-ink-50"
      )}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {isUnread ? (
          <span className="w-2 h-2 rounded-full bg-primary-500 block" />
        ) : (
          <span className="w-2 h-2 block" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="text-start w-full"
          onClick={onClick}
        >
          <p className={cn("text-sm", isUnread ? "font-semibold text-ink-900" : "text-ink-700")}>
            {n.title}
          </p>
          {n.body && (
            <p className="text-xs text-ink-500 mt-0.5 truncate">{n.body}</p>
          )}
          {n.type === "task_assigned" && requiresApproval && (
            <p className="text-xs text-amber-600 mt-0.5">נדרש אישורך לסיום המשימה</p>
          )}
          <p className="text-[10px] text-ink-400 mt-1">
            {new Date(n.created_at).toLocaleString("he-IL", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </button>

        {/* Accept / Reject for delegation notifications */}
        {(onAccept || onReject) && (
          <div className="flex gap-2 mt-2">
            {onAccept && (
              <button
                type="button"
                disabled={isPending}
                onClick={(e) => { e.stopPropagation(); onAccept(); }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                קבל
              </button>
            )}
            {onReject && (
              <button
                type="button"
                disabled={isPending}
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                סרב
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
