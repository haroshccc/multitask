import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Link } from "react-router-dom";
import {
  ListTodo,
  CalendarClock,
  Receipt,
  CalendarRange,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  DownloadCloud,
  Loader2,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import { useTasksByProject } from "@/lib/hooks/useTasks";
import { useProjectMeetings } from "@/lib/hooks/useProjectMeetings";
import { useProjectPayments } from "@/lib/hooks/useProjectPayments";
import { useProjectEvents } from "@/lib/hooks/useProjectEvents";
import { useProjectDocuments } from "@/lib/hooks/useProjectDocuments";
import { useProjectContacts } from "@/lib/hooks/useContacts";
import { useProjectCustomFields } from "@/lib/hooks/useTaskCustomFields";
import { useUpdateProject } from "@/lib/hooks/useProjects";
import {
  buildTasksSheet,
  buildMeetingsSheet,
  buildPaymentsSheet,
} from "@/lib/export/projectSheets";
import { buildWorkbook } from "@/lib/export/xlsx";
import { buildDocsZip, fetchFileByKey } from "@/lib/export/zip";
import { downloadBlob } from "@/lib/export/download";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils/cn";

// ── Local format helpers (mirrors ProjectPaymentsTab) ────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  EUR: "€",
};

function formatMoney(cents: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  const amount = (cents ?? 0) / 100;
  const formatted = amount.toLocaleString("he-IL", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return sym ? `${sym}${formatted}` : `${formatted} ${currency}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Short Hebrew relative phrasing (היום / מחר / בעוד N ימים / לפני N ימים). */
function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const startOfTarget = new Date(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate()
  ).getTime();
  const diffDays = Math.round((startOfTarget - startOfToday) / MS_PER_DAY);

  if (diffDays === 0) return "היום";
  if (diffDays === 1) return "מחר";
  if (diffDays === -1) return "אתמול";
  if (diffDays > 1 && diffDays <= 7) return `בעוד ${diffDays} ימים`;
  if (diffDays < -1 && diffDays >= -7) return `לפני ${Math.abs(diffDays)} ימים`;
  return formatDate(iso);
}

function formatTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

// ── Card shell ───────────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  to,
  linkLabel,
  children,
}: {
  title: string;
  icon: typeof ListTodo;
  to: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Icon className="w-4 h-4 text-primary-600" />
          {title}
        </h3>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors"
        >
          {linkLabel}
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-ink-400 py-3 text-center">{children}</p>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

/** "לפני X" relative phrasing for a past timestamp (backup age). */
function formatBackupAge(iso: string | null): string {
  if (!iso) return "מעולם לא גובה";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "מעולם לא גובה";
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / MS_PER_DAY);
  if (days <= 0) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours <= 0) return "גובה לאחרונה: ממש עכשיו";
    return `גובה לאחרונה: לפני ${hours} שעות`;
  }
  if (days === 1) return "גובה לאחרונה: אתמול";
  if (days < 30) return `גובה לאחרונה: לפני ${days} ימים`;
  return `גובה לאחרונה: ${formatDate(iso)}`;
}

/** Days since the last backup, or null if never backed up. */
function backupAgeDays(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / MS_PER_DAY);
}

export function ProjectDashboardTab() {
  const { project, projectId } = useProjectContext();

  const eventsRange = useMemo(() => {
    const now = new Date();
    const to = new Date(now.getTime() + 30 * MS_PER_DAY);
    return { from: now.toISOString(), to: to.toISOString() };
  }, []);

  const { data: tasks = [], isLoading: tasksLoading } =
    useTasksByProject(projectId);
  const { data: meetings = [], isLoading: meetingsLoading } =
    useProjectMeetings(projectId);
  const { data: payments = [], isLoading: paymentsLoading } =
    useProjectPayments(projectId);
  const { data: events = [], isLoading: eventsLoading } = useProjectEvents(
    projectId,
    eventsRange
  );

  // ── Backup data sources ──────────────────────────────────────────────────
  const { data: documents = [] } = useProjectDocuments(projectId);
  const { data: projectContacts = [] } = useProjectContacts(projectId);
  const { data: taskFields = [] } = useProjectCustomFields(projectId, "task");
  const { data: meetingFields = [] } = useProjectCustomFields(
    projectId,
    "meeting"
  );
  const { data: paymentFields = [] } = useProjectCustomFields(
    projectId,
    "payment"
  );
  const updateProject = useUpdateProject();
  const [isBackingUp, setIsBackingUp] = useState(false);

  const lastBackupAt = (project as { last_backup_at?: string | null })
    .last_backup_at ?? null;
  const ageDays = backupAgeDays(lastBackupAt);
  const needsBackup = ageDays === null || ageDays >= 7;

  const projectName = project.name?.trim() || "פרויקט";

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const zip = new JSZip();
      const root = zip.folder(projectName) ?? zip;

      // 1 — full documents tree under /<project>/מסמכים/…
      await buildDocsZip(
        root.folder("מסמכים") ?? root,
        "",
        documents,
        null,
        fetchFileByKey
      );

      // 2 — one workbook with all three tables under /<project>/טבלאות.xlsx
      const wb = buildWorkbook([
        buildTasksSheet(tasks, taskFields),
        buildMeetingsSheet(meetings, meetingFields),
        buildPaymentsSheet(payments, paymentFields, "תשלומים", projectContacts),
      ]);
      const xlsxArray = XLSX.write(wb, {
        type: "array",
        bookType: "xlsx",
      }) as ArrayBuffer;
      root.file("טבלאות.xlsx", xlsxArray);

      const blob = await zip.generateAsync({ type: "blob" });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`${projectName} - גיבוי ${stamp}.zip`, blob);

      await updateProject.mutateAsync({
        projectId,
        patch: { last_backup_at: new Date().toISOString() } as any,
      });
    } catch {
      alert("שגיאה ביצירת הגיבוי");
    } finally {
      setIsBackingUp(false);
    }
  };

  const nowMs = Date.now();

  // ── Tasks summary ──────────────────────────────────────────────────────────
  const taskStats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let overdue = 0;
    for (const t of tasks) {
      total += 1;
      const done = !!t.completed_at;
      if (done) {
        completed += 1;
        continue;
      }
      const dueIso = t.deadline_at ?? t.scheduled_at ?? null;
      if (dueIso) {
        const due = new Date(dueIso).getTime();
        if (!Number.isNaN(due) && due < nowMs) overdue += 1;
      }
    }
    const open = total - completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, open, completed, overdue, pct };
  }, [tasks, nowMs]);

  // ── Upcoming meetings ──────────────────────────────────────────────────────
  const upcomingMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        if (m.status === "cancelled") return false;
        if (!m.meeting_at) return false;
        const t = new Date(m.meeting_at).getTime();
        return !Number.isNaN(t) && t >= nowMs;
      })
      .sort(
        (a, b) =>
          new Date(a.meeting_at!).getTime() - new Date(b.meeting_at!).getTime()
      )
      .slice(0, 5);
  }, [meetings, nowMs]);

  // ── Payments balance ───────────────────────────────────────────────────────
  const payStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let outstanding = 0;
    for (const p of payments) {
      if (p.status === "cancelled") continue;
      if (p.direction === "in") income += p.amount_cents ?? 0;
      else if (p.direction === "out") expense += p.amount_cents ?? 0;
      if (p.status === "pending" || p.status === "overdue") outstanding += 1;
    }
    return { income, expense, balance: income - expense, outstanding };
  }, [payments]);

  const currency = payments[0]?.currency ?? "ILS";

  // ── Upcoming events ────────────────────────────────────────────────────────
  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => {
        const t = new Date(e.starts_at).getTime();
        return !Number.isNaN(t) && t >= nowMs;
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      )
      .slice(0, 5);
  }, [events, nowMs]);

  return (
    <div className="space-y-3">
      {/* Backup & download everything */}
      <div
        className={cn(
          "card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
          needsBackup && "border-amber-300 bg-amber-50/60"
        )}
      >
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <DownloadCloud className="w-4 h-4 text-primary-600" />
            גיבוי והורדה
          </h3>
          <p className="text-xs text-ink-500 mt-1">
            הורדת כל מסמכי הפרויקט והטבלאות (משימות, פגישות, תשלומים) כקובץ ZIP
            אחד.
          </p>
          <div className="mt-1.5 text-[11px]">
            <span className="text-ink-500">{formatBackupAge(lastBackupAt)}</span>
            {needsBackup && (
              <span className="inline-flex items-center gap-1 ms-2 text-amber-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {ageDays === null
                  ? "מומלץ לגבות — עוד לא בוצע גיבוי"
                  : `מומלץ לגבות — עברו ${ageDays} ימים`}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleBackup}
          disabled={isBackingUp}
          className="btn-accent text-sm inline-flex items-center gap-2 shrink-0 disabled:opacity-60"
        >
          {isBackingUp ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              מגבה…
            </>
          ) : (
            <>
              <DownloadCloud className="w-4 h-4" />
              גבי והורידי הכל
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1 — Tasks */}
      <Card title="משימות" icon={ListTodo} to="../tasks" linkLabel="לכל המשימות">
        {tasksLoading ? (
          <SkeletonLines />
        ) : taskStats.total === 0 ? (
          <EmptyHint>עוד אין משימות בפרויקט.</EmptyHint>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="פתוחות" value={taskStats.open} />
              <Stat
                label="הושלמו"
                value={taskStats.completed}
                tone="emerald"
              />
              <Stat
                label="באיחור"
                value={taskStats.overdue}
                tone={taskStats.overdue > 0 ? "rose" : undefined}
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1">
                <span>התקדמות</span>
                <span className="tabular-nums">{taskStats.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${taskStats.pct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-ink-400">
                {taskStats.completed} מתוך {taskStats.total} הושלמו
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 2 — Upcoming meetings */}
      <Card
        title="פגישות קרובות"
        icon={CalendarClock}
        to="../meetings"
        linkLabel="לכל הפגישות"
      >
        {meetingsLoading ? (
          <SkeletonLines />
        ) : upcomingMeetings.length === 0 ? (
          <EmptyHint>אין פגישות קרובות מתוזמנות.</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {upcomingMeetings.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-ink-800">
                  {m.title.trim() || "פגישה ללא שם"}
                </span>
                <span className="shrink-0 text-[11px] text-ink-500 tabular-nums">
                  {formatRelative(m.meeting_at)}
                  {!m.all_day && (
                    <span className="text-ink-400">
                      {" · "}
                      {formatTime(m.meeting_at!)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3 — Payments balance */}
      <Card
        title="מאזן תשלומים"
        icon={Receipt}
        to="../payments"
        linkLabel="לכל התשלומים"
      >
        {paymentsLoading ? (
          <SkeletonLines />
        ) : payments.length === 0 ? (
          <EmptyHint>עוד אין תשלומים בפרויקט.</EmptyHint>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  תקבולים
                </span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  {formatMoney(payStats.income, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-rose-700">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  תשלומים
                </span>
                <span className="font-semibold text-rose-700 tabular-nums">
                  {formatMoney(payStats.expense, currency)}
                </span>
              </div>
            </div>
            <div className="border-t border-ink-100 pt-2 flex items-center justify-between">
              <span className="text-xs text-ink-500">מאזן</span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  payStats.balance >= 0 ? "text-ink-900" : "text-amber-600"
                )}
              >
                {formatMoney(payStats.balance, currency)}
              </span>
            </div>
            {payStats.outstanding > 0 && (
              <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {payStats.outstanding} תשלומים ממתינים / באיחור
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 4 — Upcoming events / calendar */}
      <Card
        title="אירועים קרובים"
        icon={CalendarRange}
        to="../calendar"
        linkLabel="ליומן"
      >
        {eventsLoading ? (
          <SkeletonLines />
        ) : upcomingEvents.length === 0 ? (
          <EmptyHint>אין אירועים קרובים ב-30 הימים הבאים.</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {upcomingEvents.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-ink-800">
                  {e.title?.trim() || "אירוע ללא שם"}
                </span>
                <span className="shrink-0 text-[11px] text-ink-500 tabular-nums">
                  {formatRelative(e.starts_at)}
                  {!e.all_day && (
                    <span className="text-ink-400">
                      {" · "}
                      {formatTime(e.starts_at)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 5 — Progress summary */}
      <Card
        title="התקדמות"
        icon={CheckCircle2}
        to="../tasks"
        linkLabel="פירוט"
      >
        {tasksLoading ? (
          <SkeletonLines />
        ) : taskStats.total === 0 ? (
          <EmptyHint>הוסיפי משימות כדי לעקוב אחר ההתקדמות.</EmptyHint>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-2">
            <div className="text-4xl font-bold text-emerald-600 tabular-nums">
              {taskStats.pct}%
            </div>
            <div className="text-xs text-ink-500 mt-1">מהמשימות הושלמו</div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {taskStats.completed} הושלמו
              </span>
              <span className="inline-flex items-center gap-1">
                <ListTodo className="w-3.5 h-3.5 text-ink-400" />
                {taskStats.open} פתוחות
              </span>
            </div>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-xl bg-ink-50 border border-ink-100 px-2 py-2">
      <div
        className={cn(
          "text-xl font-bold tabular-nums",
          tone === "emerald" && "text-emerald-600",
          tone === "rose" && "text-rose-600",
          !tone && "text-ink-900"
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-2 animate-pulse py-1">
      <div className="h-3 rounded bg-ink-100 w-3/4" />
      <div className="h-3 rounded bg-ink-100 w-1/2" />
      <div className="h-3 rounded bg-ink-100 w-2/3" />
    </div>
  );
}
