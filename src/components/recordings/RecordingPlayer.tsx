import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Sparkles, Link2, Loader2, GitMerge, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  useDeleteRecording,
  useRecordingAudioUrl,
  useTriggerRecordingProcessing,
  useUpdateRecording,
} from "@/lib/hooks/useRecordings";
import {
  useRecordingLists,
  useRecordingListAssignments,
} from "@/lib/hooks/useRecordingLists";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { ListIcon } from "@/components/tasks/list-icons";
import { AudioPlayer } from "@/components/recordings/AudioPlayer";
import { RecordingLinkagePanel } from "@/components/recordings/RecordingLinkagePanel";
import { TranscriptEditor } from "@/components/recordings/TranscriptEditor";
import { MergeRecordingsDialog } from "@/components/recordings/MergeRecordingsDialog";
import { AiInsights } from "@/components/recordings/AiInsights";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

export function RecordingPlayer({ recording }: Props) {
  const { data: url, isLoading, error } = useRecordingAudioUrl(recording);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const { data: calendars = [] } = useEventCalendars();
  const { data: recordingLists = [] } = useRecordingLists();
  const { data: assignments = [] } = useRecordingListAssignments(recording.id);

  const downloadFilename = buildDownloadFilename(recording);

  const project = projects.find((p) => p.id === recording.project_id) ?? null;
  const taskList = taskLists.find((l) => l.id === recording.task_list_id) ?? null;
  const calendar = calendars.find((c) => c.id === recording.event_calendar_id) ?? null;
  const myLists = assignments
    .map((a) => recordingLists.find((l) => l.id === a.list_id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const listsSummary =
    myLists.length === 0
      ? null
      : myLists.length === 1
      ? myLists[0].name
      : `${myLists.length} רשימות`;

  return (
    <div className="card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EditableTitle recording={recording} />
          <p className="text-xs text-ink-500 mt-0.5">
            הועלתה {format(new Date(recording.created_at), "d בMMM yyyy, HH:mm", { locale: he })}
          </p>
          {recording.merged_into && (
            <p className="text-[11px] text-ink-500 mt-1 inline-flex items-center gap-1">
              <GitMerge className="w-3 h-3" />
              מוזגה לתוך הקלטה אחרת.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!recording.merged_into && (
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              className="btn-outline !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
              title="איחוד עם הקלטה נוספת"
            >
              <GitMerge className="w-3 h-3" />
              איחוד
            </button>
          )}
          <DeleteButton recording={recording} />
        </div>
      </header>

      <MergeRecordingsDialog
        recording={recording}
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
      />

      <div>
        {recording.audio_archived ? (
          <div className="rounded-md border border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-600 inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-ink-400" />
            האודיו של הקלטה זו נמחק לפי מדיניות retention. המטא-דאטה נשמר.
          </div>
        ) : (
          <AudioPlayer
            src={url}
            isLoading={isLoading}
            hasError={!!error}
            downloadFilename={downloadFilename}
            onAudioElement={setAudioElement}
          />
        )}
      </div>

      {/* שיוך — editable chip-bar with all 4 linkage types */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Link2 className="w-3.5 h-3.5 text-ink-500" />
          שיוך
        </div>
        <RecordingLinkagePanel recording={recording} />
      </section>

      {/* Read-only summary grid showing the values currently linked to this
          recording. The header was removed because it duplicated the שיוך
          label visually; the grid alone is enough at-a-glance read. */}
      <section className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <StatusMeta recording={recording} />
          <Meta label="מקור" value={sourceLabel(recording.source)} />
          <Meta label="פרויקט" value={project?.name ?? null} />
          <Meta
            label="יומן"
            value={calendar?.name ?? null}
            valueIcon={
              calendar ? <ListIcon emoji={calendar.emoji} className="w-3 h-3" /> : null
            }
          />
          <Meta
            label="משימות"
            value={taskList?.name ?? null}
            valueIcon={
              taskList ? <ListIcon emoji={taskList.emoji} className="w-3 h-3" /> : null
            }
          />
          <Meta
            label="רשימות"
            value={listsSummary}
            valueIcon={
              myLists.length === 1 ? (
                <ListIcon emoji={myLists[0].emoji} className="w-3 h-3" />
              ) : null
            }
          />
        </div>
      </section>

      <TranscriptionSection recording={recording} audioElement={audioElement} />

      {/* AI/manual processing pane is always available once the recording */}
      {/* exists. Even without a transcript the user can fill the sections by */}
      {/* hand and "הפעלת AI" gates itself on whether transcript_text is set. */}
      {recording.status !== "recording" &&
        recording.status !== "transcribing" && (
          <AiInsights recording={recording} />
        )}
    </div>
  );
}

function TranscriptionSection({
  recording,
  audioElement,
}: {
  recording: Recording;
  audioElement: HTMLAudioElement | null;
}) {
  const trigger = useTriggerRecordingProcessing();
  const status = recording.status;

  if (status === "transcribing") {
    return (
      <section className="rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin" />
          מתמללת...
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          Gladia מעבדת את ההקלטה. בדרך כלל לוקח דקה לכל ~10 דקות אודיו. הסטטוס
          יתעדכן אוטומטית כשהתמלול מוכן.
        </p>
      </section>
    );
  }

  // 'extracting' was an old transitional status that meant "Gladia done,
  // Claude AI running auto" — we removed the auto step, AI is manual now.
  // Treat any old recordings still parked there as ready (they have the
  // transcript filled, so the editor + AI button work fine).
  if (
    (status === "ready" || status === "extracting") &&
    recording.transcript_text
  ) {
    return <TranscriptEditor recording={recording} audioElement={audioElement} />;
  }

  if (status === "error") {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-700">
          <AlertCircle className="w-3.5 h-3.5" />
          שגיאת תמלול
        </div>
        {recording.error_message ? (
          <p className="text-xs text-red-700 leading-relaxed break-words">
            {recording.error_message}
          </p>
        ) : null}
        <button
          type="button"
          className="text-xs font-medium text-primary-700 hover:underline disabled:opacity-50"
          disabled={trigger.isPending}
          onClick={() => trigger.mutate(recording.id)}
        >
          נסה שוב
        </button>
      </section>
    );
  }

  // status === 'uploaded' (default landing state after upload completes)
  return (
    <section className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-3 py-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
        <Sparkles className="w-3.5 h-3.5 text-primary-600" />
        תמלול וסיכום AI
      </div>
      <p className="text-xs text-ink-500 leading-relaxed">
        Gladia מתמללת את ההקלטה עם הפרדת דוברים בעברית. תוצאה תופיע כאן.
      </p>
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={trigger.isPending}
        onClick={() => trigger.mutate(recording.id)}
      >
        {trigger.isPending ? "שולחת..." : "התחל תמלול"}
      </button>
    </section>
  );
}

function EditableTitle({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recording.title ?? "");
  // Resync the draft whenever the row changes from the server (e.g. after a
  // successful save, or when the user navigates between recordings).
  useEffect(() => {
    if (!editing) setDraft(recording.title ?? "");
  }, [recording.title, recording.id, editing]);

  const commit = () => {
    const next = draft.trim();
    if (next === (recording.title ?? "")) {
      setEditing(false);
      return;
    }
    update.mutate(
      { recordingId: recording.id, patch: { title: next || null } },
      { onSettled: () => setEditing(false) }
    );
  };

  if (!editing) {
    return (
      <h2
        className="text-lg font-semibold text-ink-900 truncate cursor-text hover:bg-ink-50 rounded px-1 -mx-1"
        title="לחיצה לעריכה"
        onClick={() => setEditing(true)}
      >
        {recording.title || "ללא כותרת"}
      </h2>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(recording.title ?? "");
          setEditing(false);
        }
      }}
      className="text-lg font-semibold text-ink-900 bg-transparent border-b border-primary-300 outline-none w-full min-w-0"
      placeholder="ללא כותרת"
    />
  );
}

function DeleteButton({ recording }: { recording: Recording }) {
  const del = useDeleteRecording();
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]">
        <span className="text-ink-700">למחוק?</span>
        <button
          type="button"
          onClick={() => del.mutate(recording.id)}
          disabled={del.isPending}
          className="btn-primary !py-1 !px-2 !text-[11px] !bg-danger-600 !border-danger-600 hover:!bg-danger-700"
        >
          {del.isPending ? "מוחקת…" : "מחיקה"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="btn-outline !py-1 !px-2 !text-[11px]"
        >
          ביטול
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="btn-outline !py-1 !px-2 !text-[11px] inline-flex items-center gap-1 text-danger-600 hover:!bg-danger-50"
      title="מחיקת ההקלטה — בלתי הפיך"
    >
      <Trash2 className="w-3 h-3" />
      מחיקה
    </button>
  );
}

function Meta({
  label,
  value,
  valueIcon,
}: {
  label: string;
  value: string | null | undefined;
  valueIcon?: ReactNode;
}) {
  return (
    <div className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-xs text-ink-800 mt-0.5 inline-flex items-center gap-1 max-w-full">
        {valueIcon}
        <span className="truncate">{value ?? "—"}</span>
      </div>
    </div>
  );
}

function StatusMeta({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const onChange = (next: Recording["status"]) => {
    if (next === recording.status) return;
    update.mutate({ recordingId: recording.id, patch: { status: next } });
  };
  return (
    <div className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">סטטוס</div>
      <select
        value={recording.status}
        onChange={(e) => onChange(e.target.value as Recording["status"])}
        disabled={update.isPending}
        className="bg-transparent text-xs text-ink-800 mt-0.5 w-full outline-none cursor-pointer hover:text-primary-700 disabled:cursor-wait"
      >
        {/* Render the current status even if it's not user-pickable (e.g. */}
        {/* `transcribing` while a job is in flight) so the dropdown reflects */}
        {/* reality and the user can flip to a manual status from there. */}
        {!USER_PICKABLE_STATUSES.some((o) => o.value === recording.status) && (
          <option value={recording.status}>{statusLabel(recording.status)}</option>
        )}
        {USER_PICKABLE_STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function statusLabel(status: Recording["status"]): string {
  switch (status) {
    case "recording":
      return "מקליטה";
    case "uploaded":
      return "הועלתה";
    case "transcribing":
      return "מתמללת";
    case "extracting":
      return "מחלצת משימות";
    case "ready":
      return "מוכנה";
    case "processing":
      return "בעיבוד";
    case "processed":
      return "עובדה";
    case "error":
      return "שגיאה";
  }
}

const USER_PICKABLE_STATUSES: Array<{
  value: Recording["status"];
  label: string;
}> = [
  { value: "uploaded", label: "הועלתה" },
  { value: "ready", label: "מוכנה" },
  { value: "processing", label: "בעיבוד" },
  { value: "processed", label: "עובדה" },
  { value: "error", label: "שגיאה" },
];

function sourceLabel(source: Recording["source"]): string {
  switch (source) {
    case "thought":
      return "מחשבה";
    case "call":
      return "שיחה";
    case "meeting":
      return "פגישה";
    default:
      return "אחר";
  }
}

function buildDownloadFilename(recording: Recording): string {
  // Take the extension from storage_key tail, fallback by mime.
  const keyTail = recording.storage_key.split("/").pop() ?? "";
  const ext =
    keyTail.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ??
    extFromMime(recording.mime_type);
  const stem = (recording.title?.trim() || "recording")
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 80);
  return `${stem}.${ext}`;
}

function extFromMime(t: string): string {
  const s = (t ?? "").toLowerCase();
  if (s.includes("mpeg") || s.includes("mp3")) return "mp3";
  if (s.includes("mp4") || s.includes("m4a") || s.includes("aac")) return "m4a";
  if (s.includes("webm")) return "webm";
  if (s.includes("ogg") || s.includes("opus")) return "ogg";
  if (s.includes("wav")) return "wav";
  return "audio";
}
