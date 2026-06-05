import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Loader2,
  CalendarClock,
  CalendarPlus,
  Mic,
  Trash2,
  X,
  ExternalLink,
  Table2,
  LayoutGrid,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import {
  useProjectMeetings,
  useCreateProjectMeeting,
  useUpdateProjectMeeting,
  useDeleteProjectMeeting,
  useMeetingTaskLinks,
  useLinkMeetingTask,
  useUnlinkMeetingTask,
  type ProjectMeeting,
} from "@/lib/hooks/useProjectMeetings";
import { useTasksByProject } from "@/lib/hooks/useTasks";
import { useRecordings } from "@/lib/hooks/useRecordings";
import { useCreateEvent } from "@/lib/hooks/useEvents";
import { cn } from "@/lib/utils/cn";

const VIEW_KEY = "multitask.projectMeetings.view";
type ViewMode = "table" | "cards";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "scheduled", label: "מתוכננת" },
  { value: "done", label: "התקיימה" },
  { value: "cancelled", label: "בוטלה" },
];
const STATUS_LABEL = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function fromLocalInput(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectMeetingsTab() {
  const { projectId } = useProjectContext();
  const { data: meetings = [], isLoading } = useProjectMeetings(projectId);
  const { data: links = [] } = useMeetingTaskLinks(projectId);
  const createMeeting = useCreateProjectMeeting();
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
  });
  const setViewPersist = (v: ViewMode) => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, v);
  };

  const linkCountByMeeting = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.meeting_id, (m.get(l.meeting_id) ?? 0) + 1);
    return m;
  }, [links]);

  const openMeeting = meetings.find((m) => m.id === openId) ?? null;

  const handleCreate = async () => {
    const m = await createMeeting.mutateAsync({ projectId, title: "" });
    setOpenId(m.id);
  };

  if (isLoading) {
    return (
      <div className="card p-10 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען פגישות…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ViewToggle view={view} onChange={setViewPersist} />
        <button
          type="button"
          onClick={handleCreate}
          disabled={createMeeting.isPending}
          className="btn-accent text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          פגישה חדשה
        </button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : view === "table" ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 border-b border-ink-200">
                <tr className="text-start text-ink-500 text-xs">
                  <th className="text-start font-semibold px-3 py-2">פגישה</th>
                  <th className="text-start font-semibold px-3 py-2">מתי</th>
                  <th className="text-start font-semibold px-3 py-2">סטטוס</th>
                  <th className="text-start font-semibold px-3 py-2">משימות</th>
                  <th className="text-start font-semibold px-3 py-2">הקלטה</th>
                  <th className="w-8 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    projectId={projectId}
                    linkCount={linkCountByMeeting.get(m.id) ?? 0}
                    onOpen={() => setOpenId(m.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              linkCount={linkCountByMeeting.get(m.id) ?? 0}
              onOpen={() => setOpenId(m.id)}
            />
          ))}
        </div>
      )}

      {openMeeting && (
        <MeetingDetailModal
          meeting={openMeeting}
          projectId={projectId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center">
      <CalendarClock className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        עוד אין פגישות
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        כל פגישה יכולה להחזיק תאריך, נקודות, משימות מקושרות, קישור להקלטה עם
        סיכום AI ואירוע ביומן.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-accent text-sm inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        פגישה ראשונה
      </button>
    </div>
  );
}

function MeetingRow({
  meeting,
  projectId,
  linkCount,
  onOpen,
}: {
  meeting: ProjectMeeting;
  projectId: string;
  linkCount: number;
  onOpen: () => void;
}) {
  const del = useDeleteProjectMeeting();
  return (
    <tr className="border-b border-ink-100 hover:bg-ink-50">
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="text-start font-medium text-ink-900 hover:text-primary-700"
        >
          {meeting.title.trim() || "פגישה ללא שם"}
        </button>
      </td>
      <td className="px-3 py-2 text-ink-600 whitespace-nowrap">
        {formatWhen(meeting.meeting_at)}
      </td>
      <td className="px-3 py-2">
        <span className="chip">
          {STATUS_LABEL[meeting.status] ?? meeting.status}
        </span>
      </td>
      <td className="px-3 py-2">
        {linkCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-600">
            <ListChecks className="w-3.5 h-3.5" />
            {linkCount}
          </span>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {meeting.recording_id ? (
          <Link
            to={`/app/recordings?id=${meeting.recording_id}`}
            className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
          >
            <Mic className="w-3.5 h-3.5" />
            לעמוד ההקלטה
          </Link>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-end">
        <button
          type="button"
          onClick={() => {
            if (confirm("למחוק את הפגישה?"))
              del.mutate({ id: meeting.id, projectId });
          }}
          className="p-1 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger/10"
          aria-label="מחק פגישה"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function MeetingCard({
  meeting,
  linkCount,
  onOpen,
}: {
  meeting: ProjectMeeting;
  linkCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card p-4 text-start hover:shadow-lift transition-shadow flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink-900 leading-snug">
          {meeting.title.trim() || "פגישה ללא שם"}
        </h4>
        <span className="chip shrink-0">
          {STATUS_LABEL[meeting.status] ?? meeting.status}
        </span>
      </div>
      <div className="text-xs text-ink-500 inline-flex items-center gap-1">
        <CalendarClock className="w-3.5 h-3.5" />
        {formatWhen(meeting.meeting_at)}
      </div>
      {meeting.notes && (
        <p className="text-xs text-ink-600 line-clamp-2">{meeting.notes}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-ink-500 mt-auto pt-1">
        {linkCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" />
            {linkCount}
          </span>
        )}
        {meeting.recording_id && (
          <span className="inline-flex items-center gap-1 text-primary-700">
            <Mic className="w-3.5 h-3.5" />
            הקלטה
          </span>
        )}
        {meeting.event_id && (
          <span className="inline-flex items-center gap-1 text-primary-700">
            <CalendarPlus className="w-3.5 h-3.5" />
            ביומן
          </span>
        )}
      </div>
    </button>
  );
}

function MeetingDetailModal({
  meeting,
  projectId,
  onClose,
}: {
  meeting: ProjectMeeting;
  projectId: string;
  onClose: () => void;
}) {
  const update = useUpdateProjectMeeting();
  const createEvent = useCreateEvent();
  const { data: recordings = [] } = useRecordings();
  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: links = [] } = useMeetingTaskLinks(projectId);
  const linkTask = useLinkMeetingTask();
  const unlinkTask = useUnlinkMeetingTask();

  const [title, setTitle] = useState(meeting.title);
  const [when, setWhen] = useState(toLocalInput(meeting.meeting_at));
  const [location, setLocation] = useState(meeting.location ?? "");
  const [status, setStatus] = useState(meeting.status);
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [summary, setSummary] = useState(meeting.summary ?? "");
  const [recordingId, setRecordingId] = useState(meeting.recording_id ?? "");
  const [eventId, setEventId] = useState(meeting.event_id ?? "");

  const projectRecordings = useMemo(
    () => recordings.filter((r) => r.project_id === projectId),
    [recordings, projectId]
  );
  const selectedRecording = projectRecordings.find((r) => r.id === recordingId);

  const myLinks = useMemo(
    () => links.filter((l) => l.meeting_id === meeting.id),
    [links, meeting.id]
  );
  const linkedTaskIds = new Set(myLinks.map((l) => l.task_id));
  const linkedTasks = tasks.filter((t) => linkedTaskIds.has(t.id));
  const linkableTasks = tasks.filter(
    (t) => !linkedTaskIds.has(t.id) && !t.completed_at
  );

  const recordingSummary = (rec: typeof selectedRecording): string => {
    if (!rec) return "";
    const fromOutput =
      rec.summary ||
      ((rec.ai_output as any)?.summary as string | undefined) ||
      "";
    return fromOutput;
  };
  const canPullSummary = !!recordingSummary(selectedRecording);

  const save = () => {
    update.mutate({
      id: meeting.id,
      projectId,
      patch: {
        title: title.trim(),
        meeting_at: fromLocalInput(when),
        location: location.trim() || null,
        status,
        notes: notes.trim() || null,
        summary: summary.trim() || null,
        recording_id: recordingId || null,
      },
    });
    onClose();
  };

  const createCalendarEvent = async () => {
    const starts = fromLocalInput(when);
    if (!starts) return;
    const ends = new Date(
      new Date(starts).getTime() + 60 * 60 * 1000
    ).toISOString();
    const ev = await createEvent.mutateAsync({
      title: title.trim() || "פגישה",
      starts_at: starts,
      ends_at: ends,
      all_day: false,
      location: location.trim() || null,
      source_recording_id: recordingId || null,
    } as any);
    setEventId(ev.id);
    update.mutate({ id: meeting.id, projectId, patch: { event_id: ev.id } });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">פרטי פגישה</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100"
          >
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          <div>
            <label className="eyebrow mb-1.5 block">שם הפגישה</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: פגישת אפיון עם הלקוח"
              className="field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">תאריך ושעה</label>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">סטטוס</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">מיקום</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="זום / משרד…"
                className="field"
              />
            </div>
          </div>

          {/* Recording link */}
          <div>
            <label className="eyebrow mb-1.5 block">הקלטה מקושרת</label>
            <div className="flex items-center gap-2">
              <select
                value={recordingId}
                onChange={(e) => setRecordingId(e.target.value)}
                className="field flex-1"
              >
                <option value="">— ללא הקלטה —</option>
                {projectRecordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title?.trim() || "הקלטה ללא שם"}
                  </option>
                ))}
              </select>
              {recordingId && (
                <Link
                  to={`/app/recordings?id=${recordingId}`}
                  className="btn-ghost text-xs inline-flex items-center gap-1 shrink-0"
                  title="פתח את עמוד ההקלטה"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  פתח
                </Link>
              )}
            </div>
            {recordingId && (
              <button
                type="button"
                disabled={!canPullSummary}
                onClick={() => setSummary(recordingSummary(selectedRecording))}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-700 hover:underline disabled:text-ink-300 disabled:no-underline"
                title={
                  canPullSummary
                    ? "העתק את סיכום ה-AI מההקלטה לשדה הסיכום"
                    : "אין עדיין סיכום AI בהקלטה הזו"
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                משוך סיכום AI מההקלטה
              </button>
            )}
          </div>

          {/* Linked tasks */}
          <div>
            <label className="eyebrow mb-1.5 block">משימות מקושרות</label>
            {linkedTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {linkedTasks.map((t) => {
                  const link = myLinks.find((l) => l.task_id === t.id)!;
                  return (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 chip"
                    >
                      {t.title?.trim() || "משימה"}
                      <button
                        type="button"
                        onClick={() =>
                          unlinkTask.mutate({ linkId: link.id, projectId })
                        }
                        className="text-ink-400 hover:text-danger-600"
                        aria-label="הסר קישור"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value)
                  linkTask.mutate({
                    projectId,
                    meetingId: meeting.id,
                    taskId: e.target.value,
                  });
              }}
              className="field"
            >
              <option value="">+ קשרי משימה מהפרויקט…</option>
              {linkableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title?.trim() || "משימה ללא שם"}
                </option>
              ))}
            </select>
          </div>

          {/* Calendar event */}
          <div>
            <label className="eyebrow mb-1.5 block">אירוע יומן</label>
            {eventId ? (
              <Link
                to="/app/calendar"
                className="inline-flex items-center gap-1.5 text-sm text-primary-700 hover:underline"
              >
                <CalendarPlus className="w-4 h-4" />
                אירוע מקושר ביומן — פתח יומן
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                disabled={!when || createEvent.isPending}
                onClick={createCalendarEvent}
                className="btn-ghost text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                title={when ? "" : "קבעי קודם תאריך ושעה לפגישה"}
              >
                <CalendarPlus className="w-4 h-4" />
                {createEvent.isPending ? "יוצר…" : "צרי אירוע ביומן"}
              </button>
            )}
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">נקודות / הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="נקודות שעלו בפגישה…"
              className="field resize-y"
            />
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">סיכום</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="סיכום הפגישה (אפשר למשוך סיכום AI מההקלטה למעלה)…"
              className="field resize-y"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            ביטול
          </button>
          <button
            onClick={save}
            disabled={update.isPending}
            className={cn(
              "btn-accent text-sm",
              update.isPending && "opacity-50"
            )}
          >
            {update.isPending ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "table"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <Table2 className="w-3.5 h-3.5" />
        טבלה
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "cards"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        כרטיסיות
      </button>
    </div>
  );
}
