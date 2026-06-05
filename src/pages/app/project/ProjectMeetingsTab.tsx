import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Loader2,
  CalendarClock,
  Mic,
  Trash2,
  X,
  ExternalLink,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import {
  useProjectMeetings,
  useCreateProjectMeeting,
  useUpdateProjectMeeting,
  useDeleteProjectMeeting,
  type ProjectMeeting,
} from "@/lib/hooks/useProjectMeetings";
import { cn } from "@/lib/utils/cn";

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
  const createMeeting = useCreateProjectMeeting();
  const [openId, setOpenId] = useState<string | null>(null);

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
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-ink-500">
          {meetings.length} פגישות
        </div>
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
        <div className="card p-8 text-center">
          <CalendarClock className="w-9 h-9 text-ink-300 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-ink-900 mb-1">
            עוד אין פגישות
          </h3>
          <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
            כל פגישה יכולה להחזיק תאריך, נקודות, קישור להקלטה וסיכום.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="btn-accent text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            פגישה ראשונה
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 border-b border-ink-200">
                <tr className="text-start text-ink-500 text-xs">
                  <th className="text-start font-semibold px-3 py-2">פגישה</th>
                  <th className="text-start font-semibold px-3 py-2">מתי</th>
                  <th className="text-start font-semibold px-3 py-2">סטטוס</th>
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
                    onOpen={() => setOpenId(m.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
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

function MeetingRow({
  meeting,
  projectId,
  onOpen,
}: {
  meeting: ProjectMeeting;
  projectId: string;
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
        <span className="chip">{STATUS_LABEL[meeting.status] ?? meeting.status}</span>
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
  const [title, setTitle] = useState(meeting.title);
  const [when, setWhen] = useState(toLocalInput(meeting.meeting_at));
  const [location, setLocation] = useState(meeting.location ?? "");
  const [status, setStatus] = useState(meeting.status);
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [summary, setSummary] = useState(meeting.summary ?? "");

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
      },
    });
    onClose();
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
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

          {meeting.recording_id && (
            <Link
              to={`/app/recordings?id=${meeting.recording_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary-700 hover:underline"
            >
              <Mic className="w-4 h-4" />
              פתח את עמוד ההקלטה המקושרת
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <div>
            <label className="eyebrow mb-1.5 block">נקודות / הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
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
              placeholder="סיכום הפגישה (אפשר יהיה לחבר סיכום AI מההקלטה בהמשך)…"
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
            className={cn("btn-accent text-sm", update.isPending && "opacity-50")}
          >
            {update.isPending ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
