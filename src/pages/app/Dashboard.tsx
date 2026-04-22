import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import {
  ArrowLeft,
  CheckSquare,
  Flame,
  Inbox,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import { useThoughts } from "@/lib/queries/thoughts";
import { useTasks } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

export function Dashboard() {
  const { profile, activeOrganizationId } = useAuth();

  const unprocessedThoughts = useThoughts(activeOrganizationId, {
    status: "unprocessed",
    limit: 5,
  });
  const todayTasks = useTasks(activeOrganizationId, { scope: "today", limit: 5 });
  const openTasks = useTasks(activeOrganizationId, { scope: "open", limit: 100 });

  const openCount = openTasks.data?.length ?? 0;
  const urgentCount =
    openTasks.data?.filter((t) => t.urgency >= 4 && t.status !== "done").length ?? 0;

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <ScreenScaffold
      title={firstName ? `שלום, ${firstName} 👋` : "דשבורד"}
      subtitle="סקירה מהירה של היום שלך."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <StatCard
          icon={CheckSquare}
          label="משימות פתוחות"
          value={openTasks.isLoading ? "…" : String(openCount)}
          href="/app/tasks"
        />
        <StatCard
          icon={Flame}
          label="דחופות (4-5)"
          value={openTasks.isLoading ? "…" : String(urgentCount)}
          accent={urgentCount > 0}
          href="/app/tasks"
        />
        <StatCard
          icon={Lightbulb}
          label="מחשבות לעבד"
          value={
            unprocessedThoughts.isLoading
              ? "…"
              : String(unprocessedThoughts.data?.length ?? 0)
          }
          href="/app/thoughts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Widget
          title="להיום"
          icon={CheckSquare}
          href="/app/tasks"
          loading={todayTasks.isLoading}
          empty={
            !todayTasks.isLoading &&
            (!todayTasks.data || todayTasks.data.length === 0) ? (
              <EmptyWidget
                icon={Inbox}
                title="היום ריק"
                body="משימות עם מועד להיום יופיעו כאן."
              />
            ) : null
          }
        >
          {todayTasks.data?.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-2 py-2 border-b border-ink-200 last:border-0"
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full mt-1.5 shrink-0",
                  task.status === "done" ? "bg-success-500" : "bg-primary-500"
                )}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm",
                    task.status === "done"
                      ? "line-through text-ink-500"
                      : "text-ink-900"
                  )}
                >
                  {task.title}
                </div>
                {task.scheduled_at && (
                  <div className="text-xs text-ink-500 mt-0.5">
                    {new Date(task.scheduled_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </Widget>

        <Widget
          title="מחשבות ממתינות"
          icon={Lightbulb}
          href="/app/thoughts"
          loading={unprocessedThoughts.isLoading}
          empty={
            !unprocessedThoughts.isLoading &&
            (!unprocessedThoughts.data || unprocessedThoughts.data.length === 0) ? (
              <EmptyWidget
                icon={Sparkles}
                title="אין מחשבות ממתינות"
                body="זרקי רעיון דרך כפתור ה-+ למעלה או במסך המחשבות."
              />
            ) : null
          }
        >
          {unprocessedThoughts.data?.map((thought) => (
            <div key={thought.id} className="py-2 border-b border-ink-200 last:border-0">
              <div className="text-sm text-ink-900 line-clamp-2 leading-relaxed">
                {thought.ai_generated_title ||
                  thought.text_content ||
                  "(ללא תוכן)"}
              </div>
              <div className="text-xs text-ink-400 mt-1">
                {formatDistanceToNow(new Date(thought.created_at), {
                  addSuffix: true,
                  locale: he,
                })}
              </div>
            </div>
          ))}
        </Widget>
      </div>

      <div className="mt-5 card p-4 md:p-5 bg-gradient-to-br from-primary-50 via-white to-ink-100 border-primary-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white shadow-soft flex items-center justify-center">
            <Plus className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-ink-900 mb-0.5">יצירה מהירה</div>
            <p className="text-sm text-ink-600">
              לחצי על כפתור ה-+ למעלה בכל רגע כדי לזרוק מחשבה, להוסיף משימה, או
              לפתוח אירוע.
            </p>
          </div>
        </div>
      </div>
    </ScreenScaffold>
  );
}

interface StatCardProps {
  icon: typeof CheckSquare;
  label: string;
  value: string;
  href: string;
  accent?: boolean;
}

function StatCard({ icon: Icon, label, value, href, accent }: StatCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        "card-lift p-4 flex items-center gap-3",
        accent && "border-primary-300 bg-primary-50/40"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          accent ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-700"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-ink-500">{label}</div>
        <div className="text-2xl font-bold text-ink-900 tabular-nums leading-tight">
          {value}
        </div>
      </div>
    </Link>
  );
}

interface WidgetProps {
  title: string;
  icon: typeof CheckSquare;
  href: string;
  children?: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
}

function Widget({ title, icon: Icon, href, children, empty, loading }: WidgetProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        </div>
        <Link
          to={href}
          className="text-xs text-ink-500 hover:text-ink-900 flex items-center gap-1"
        >
          לפתיחה
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>
      {loading ? (
        <div className="py-6 flex items-center justify-center text-ink-400">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : empty ? (
        empty
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

function EmptyWidget({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CheckSquare;
  title: string;
  body: string;
}) {
  return (
    <div className="py-5 text-center">
      <Icon className="w-6 h-6 text-ink-400 mx-auto mb-2" />
      <div className="text-sm font-medium text-ink-700">{title}</div>
      <div className="text-xs text-ink-500 mt-0.5">{body}</div>
    </div>
  );
}
