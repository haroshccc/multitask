import type { ReactNode } from "react";
import { AlertCircle, Sparkles, Link2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  useRecordingAudioUrl,
  useTriggerRecordingProcessing,
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
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

export function RecordingPlayer({ recording }: Props) {
  const { data: url, isLoading, error } = useRecordingAudioUrl(recording);
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
      <header>
        <h2 className="text-lg font-semibold text-ink-900">
          {recording.title || "ללא כותרת"}
        </h2>
        <p className="text-xs text-ink-500 mt-0.5">
          הועלתה {format(new Date(recording.created_at), "d בMMM yyyy, HH:mm", { locale: he })}
        </p>
      </header>

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
          <Meta label="סטטוס" value={statusLabel(recording.status)} />
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

      <TranscriptionSection recording={recording} />
    </div>
  );
}

function TranscriptionSection({ recording }: { recording: Recording }) {
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

  if (status === "extracting") {
    return (
      <section className="rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin" />
          מחלצת משימות...
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          התמלול מוכן. Claude מנתח אותו עכשיו לסיכום ומשימות.
        </p>
      </section>
    );
  }

  if (status === "ready" && recording.transcript_text) {
    return (
      <section className="rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          תמלול
          {recording.speakers_count
            ? ` · ${recording.speakers_count} דוברים`
            : null}
        </div>
        <p className="text-xs text-ink-700 leading-relaxed whitespace-pre-wrap max-h-60 overflow-auto">
          {recording.transcript_text}
        </p>
      </section>
    );
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
    case "error":
      return "שגיאה";
  }
}

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
