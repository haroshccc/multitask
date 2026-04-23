import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/queries/notifications";
import type { Notification } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const TYPE_LABEL: Record<string, string> = {
  task_assigned: "משימה הוקצתה לך",
  task_approval_requested: "בקשת אישור משימה",
  task_approved: "משימה אושרה",
  task_due_soon: "משימה לפני המועד",
  event_invited: "הוזמנת לאירוע",
  event_starting_soon: "אירוע מתחיל בקרוב",
  thought_received: "מחשבה התקבלה",
  recording_ready: "תמלול מוכן",
  project_over_budget: "פרויקט חרג מתקציב",
  org_member_joined: "חבר חדש בארגון",
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useNotifications(user?.id ?? null);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "p-2 rounded-xl hover:bg-ink-100 relative",
          open && "bg-ink-100"
        )}
        aria-label="התראות"
      >
        <Bell className="w-5 h-5 text-ink-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-ink-200 rounded-2xl shadow-lift overflow-hidden z-40">
          <div className="px-4 py-2.5 border-b border-ink-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">התראות</h3>
            {unreadCount > 0 && user && (
              <button
                onClick={() => markAllRead.mutate(user.id)}
                disabled={markAllRead.isPending}
                className="text-xs text-ink-600 hover:text-ink-900 flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                סמני הכל כנקרא
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-ink-400" />
              </div>
            ) : !data || data.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-500">
                אין עדיין התראות.
              </div>
            ) : (
              <ul>
                {data.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onClick={() => {
                      if (!n.read_at) markRead.mutate(n.id);
                      if (n.action_url) {
                        setOpen(false);
                        window.location.href = n.action_url;
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const unread = !notification.read_at;
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full text-start px-4 py-3 border-b border-ink-200 last:border-0 hover:bg-ink-50 flex items-start gap-2",
          unread && "bg-primary-50/30"
        )}
      >
        {unread && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-500">
            {TYPE_LABEL[notification.type] ?? notification.type}
          </div>
          <div className="text-sm text-ink-900 mt-0.5">{notification.title}</div>
          {notification.body && (
            <div className="text-xs text-ink-600 mt-0.5 line-clamp-2">
              {notification.body}
            </div>
          )}
          <div className="text-[10px] text-ink-400 mt-1">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: he,
            })}
          </div>
        </div>
      </button>
    </li>
  );
}
