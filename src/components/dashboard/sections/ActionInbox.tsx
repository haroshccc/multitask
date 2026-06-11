import { Link } from "react-router-dom";
import { Bell, ChevronLeft, Inbox, Lightbulb, Sparkles } from "lucide-react";
import { useThoughts } from "@/lib/hooks/useThoughts";
import { useUnreadNotificationsCount } from "@/lib/hooks/useNotifications";
import { SectionCard, CountBadge } from "./SectionCard";

// =============================================================================
// "ממתין לטיפול" — one inbox instead of scattered widgets: unread
// notifications + unprocessed thoughts, each deep-linking to its surface.
// Rows that have nothing to say simply don't render.
// =============================================================================

const MAX_THOUGHTS = 3;

export function ActionInbox() {
  const { data: thoughts = [] } = useThoughts({ status: "unprocessed" });
  const { data: unread = 0 } = useUnreadNotificationsCount();

  const total = thoughts.length + unread;

  return (
    <SectionCard
      icon={<Inbox className="w-4 h-4" />}
      title="ממתין לטיפול"
      badge={<CountBadge count={total} />}
    >
      {total === 0 ? (
        <div className="flex items-center gap-2 text-xs text-ink-500 py-3">
          <Sparkles className="w-4 h-4 text-success-500" aria-hidden="true" />
          הכול מטופל — אין שום דבר שממתין לך.
        </div>
      ) : (
        <div className="space-y-2">
          {unread > 0 && (
            <Link
              to="/app/notifications"
              className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-2 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span className="flex-1 text-xs font-medium text-ink-700">
                התראות חדשות
              </span>
              <CountBadge count={unread} />
              <ChevronLeft className="w-3.5 h-3.5 text-ink-400" aria-hidden="true" />
            </Link>
          )}

          {thoughts.length > 0 && (
            <div className="rounded-lg border border-ink-200 bg-white overflow-hidden">
              <Link
                to="/app/thoughts"
                className="flex items-center gap-2 px-2.5 py-2 hover:bg-primary-50/40 transition-colors"
              >
                <Lightbulb
                  className="w-3.5 h-3.5 text-amber-500"
                  aria-hidden="true"
                />
                <span className="flex-1 text-xs font-medium text-ink-700">
                  מחשבות לעיבוד
                </span>
                <CountBadge count={thoughts.length} />
                <ChevronLeft
                  className="w-3.5 h-3.5 text-ink-400"
                  aria-hidden="true"
                />
              </Link>
              <ul className="border-t border-ink-100 divide-y divide-ink-100">
                {thoughts.slice(0, MAX_THOUGHTS).map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/app/thoughts"
                      className="block px-2.5 py-1.5 hover:bg-ink-50 transition-colors"
                    >
                      <span className="block text-[11px] text-ink-700 truncate">
                        {t.ai_generated_title ??
                          (t.text_content ?? "מחשבה").slice(0, 60)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {thoughts.length > MAX_THOUGHTS && (
                <Link
                  to="/app/thoughts"
                  className="block text-center text-[11px] text-primary-600 hover:underline py-1.5 border-t border-ink-100"
                >
                  ועוד {thoughts.length - MAX_THOUGHTS} מחשבות…
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
