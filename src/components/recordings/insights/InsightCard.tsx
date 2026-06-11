import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  FolderOpen,
  ListChecks,
  Loader2,
  Phone,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import {
  useRecording,
  useTriggerAiProcessing,
  useUpdateRecording,
} from "@/lib/hooks/useRecordings";
import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";
import type { RecordingAiOutput } from "@/lib/services/recordings";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
  /** Whether this recording still needs cataloging (no project/list/tags). */
  isUnfiled: boolean;
  /** Names of the recording lists this recording is assigned to. */
  listNames: string[];
  /** Project name, if assigned. */
  projectName: string | null;
  onFile: () => void;
}

type Phase = "transcribing" | "summarizing" | "ready" | "empty" | "error";

function derivePhase(recording: Recording, ai: RecordingAiOutput | null): Phase {
  const hasTranscript = !!recording.transcript_text?.trim();
  if (recording.status === "transcribing" || (!hasTranscript && recording.status === "uploaded"))
    return "transcribing";
  if (recording.status === "error" && !hasTranscript) return "error";
  if (recording.ai_status === "pending" || recording.status === "processing")
    return "summarizing";
  if (recording.ai_status === "error") return "error";
  if (ai?.short_summary?.trim()) return "ready";
  return "empty";
}

export function InsightCard({
  recording,
  isUnfiled,
  listNames,
  projectName,
  onFile,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const ai = (recording.ai_output as RecordingAiOutput | null) ?? null;
  const phase = derivePhase(recording, ai);
  const SourceIcon = recording.source === "call" ? Phone : Sparkles;

  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-soft transition-colors",
        isUnfiled ? "border-amber-300" : "border-ink-200",
      )}
    >
      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
              "bg-primary-50 text-primary-600",
            )}
          >
            <SourceIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <InlineTitle recording={recording} />
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
              <span>
                {format(new Date(recording.created_at), "HH:mm", { locale: he })}
              </span>
              {recording.duration_seconds != null && (
                <span>· {formatDuration(recording.duration_seconds)}</span>
              )}
              <SpeakerLine count={recording.speakers_count} />
            </div>
          </div>
          {isUnfiled && (
            <button
              type="button"
              onClick={onFile}
              className="btn-primary !py-1 !px-2.5 !text-xs inline-flex items-center gap-1 shrink-0"
              title="תיוק מודרך בעזרת AI"
            >
              <Sparkles className="w-3 h-3" />
              תייק
            </button>
          )}
        </div>

        {/* Body — depends on pipeline phase */}
        {phase === "transcribing" && (
          <PhaseLine icon="spin" text="מתמללת את ההקלטה…" />
        )}
        {phase === "summarizing" && (
          <PhaseLine icon="spin" text="מסכמת עם AI…" />
        )}
        {phase === "error" && (
          <ErrorLine recording={recording} />
        )}
        {phase === "empty" && (
          <EmptySummary recording={recording} />
        )}
        {phase === "ready" && ai && (
          <ReadyBody ai={ai} onOpenSource={() => setExpanded(true)} />
        )}

        {/* Filing chips */}
        {(projectName || listNames.length > 0 || (recording.tags?.length ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {projectName && (
              <Chip icon={<FolderOpen className="w-3 h-3" />} text={projectName} />
            )}
            {listNames.map((n) => (
              <Chip key={n} icon={<ListChecks className="w-3 h-3" />} text={n} />
            ))}
            {(recording.tags ?? []).map((t) => (
              <Chip key={t} icon={<Tag className="w-3 h-3" />} text={t} tone="ink" />
            ))}
          </div>
        )}

        {/* Source expander */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-medium text-ink-500 hover:text-primary-700 inline-flex items-center gap-1"
        >
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "הסתר מקור" : "הצג מקור (אודיו ותמלול)"}
        </button>
      </div>

      {expanded && <SourceExpander recordingId={recording.id} fallback={recording} />}
    </article>
  );
}

function ReadyBody({
  ai,
  onOpenSource,
}: {
  ai: RecordingAiOutput;
  onOpenSource: () => void;
}) {
  const tasks = ai.tasks ?? [];
  const events = ai.events ?? [];
  const shownTasks = tasks.slice(0, 3);
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-ink-800 leading-relaxed" dir="auto">
        {ai.short_summary}
      </p>

      {tasks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-500">
            <CheckSquare className="w-3 h-3" />
            משימות ({tasks.length})
          </div>
          <ul className="space-y-0.5">
            {shownTasks.map((t, i) => (
              <li
                key={i}
                className="text-xs text-ink-700 flex items-start gap-1.5"
                dir="auto"
              >
                <span className="text-ink-300 mt-0.5">•</span>
                <span className="min-w-0 flex-1">
                  {t.title}
                  {t.speaker_name ? (
                    <span className="text-ink-400"> — {t.speaker_name}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {tasks.length > shownTasks.length && (
            <button
              type="button"
              onClick={onOpenSource}
              className="text-[11px] text-primary-700 hover:underline"
            >
              +{tasks.length - shownTasks.length} משימות נוספות · המרה למשימות ↓
            </button>
          )}
          {tasks.length > 0 && tasks.length <= shownTasks.length && (
            <button
              type="button"
              onClick={onOpenSource}
              className="text-[11px] text-primary-700 hover:underline"
            >
              המרה למשימות ↓
            </button>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {events.map((e, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-violet-50 text-violet-700 px-2 py-0.5 text-[11px]"
              dir="auto"
            >
              <CalendarClock className="w-3 h-3" />
              {e.title}
              {e.date_iso ? (
                <span className="text-violet-400">
                  {" "}
                  · {format(new Date(e.date_iso), "d/M", { locale: he })}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceExpander({
  recordingId,
  fallback,
}: {
  recordingId: string;
  fallback: Recording;
}) {
  // Heavy fields (transcript_json) live only on the full row — fetch lazily.
  const { data: full } = useRecording(recordingId);
  const recording = full ?? fallback;
  return (
    <div className="border-t border-ink-100 bg-ink-50/40 p-3 rounded-b-xl">
      <RecordingPlayer key={recording.id} recording={recording} />
    </div>
  );
}

function InlineTitle({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recording.title ?? "");
  useEffect(() => {
    if (!editing) setDraft(recording.title ?? "");
  }, [recording.title, recording.id, editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (recording.title ?? "")) {
      update.mutate({ recordingId: recording.id, patch: { title: next || null } });
    }
    setEditing(false);
  };

  if (editing) {
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
        className="w-full text-sm font-semibold text-ink-900 bg-transparent border-b border-primary-300 outline-none"
        placeholder="ללא כותרת"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-sm font-semibold text-ink-900 text-start truncate w-full hover:text-primary-700"
      title="לחיצה לעריכת הכותרת"
    >
      {recording.title || "ללא כותרת"}
    </button>
  );
}

function SpeakerLine({ count }: { count: number | null }) {
  if (count == null || count <= 1) {
    return (
      <span className="inline-flex items-center gap-1">
        · <Users className="w-3 h-3" /> הקלטה אישית
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      · <Users className="w-3 h-3" /> {count} דוברים
    </span>
  );
}

function PhaseLine({ icon, text }: { icon: "spin"; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-500 py-1">
      {icon === "spin" && <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin" />}
      {text}
      <span className="flex-1 h-3 rounded bg-ink-100 animate-pulse" />
    </div>
  );
}

function ErrorLine({ recording }: { recording: Recording }) {
  const trigger = useTriggerAiProcessing();
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-red-700">
        <AlertCircle className="w-3.5 h-3.5" />
        {recording.error_message ? "שגיאה בעיבוד" : "שגיאה"}
      </div>
      {recording.error_message && (
        <p className="text-[11px] text-red-700 break-words leading-relaxed">
          {recording.error_message}
        </p>
      )}
      {recording.transcript_text?.trim() && (
        <button
          type="button"
          disabled={trigger.isPending}
          onClick={() => trigger.mutate({ recordingId: recording.id })}
          className="text-[11px] font-medium text-primary-700 hover:underline disabled:opacity-50"
        >
          {trigger.isPending ? "מנסה…" : "נסה שוב"}
        </button>
      )}
    </div>
  );
}

function EmptySummary({ recording }: { recording: Recording }) {
  const trigger = useTriggerAiProcessing();
  const hasTranscript = !!recording.transcript_text?.trim();
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-ink-500 py-1">
      <span>{hasTranscript ? "אין סיכום עדיין." : "אין תמלול עדיין."}</span>
      {hasTranscript && (
        <button
          type="button"
          disabled={trigger.isPending}
          onClick={() => trigger.mutate({ recordingId: recording.id })}
          className="text-[11px] font-medium text-primary-700 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          {trigger.isPending ? "מסכמת…" : "סכם עכשיו"}
        </button>
      )}
    </div>
  );
}

function Chip({
  icon,
  text,
  tone = "primary",
}: {
  icon: React.ReactNode;
  text: string;
  tone?: "primary" | "ink";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] max-w-[12rem] truncate",
        tone === "primary"
          ? "bg-primary-50 text-primary-700"
          : "bg-ink-100 text-ink-600",
      )}
    >
      {icon}
      <span className="truncate">{text}</span>
    </span>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} שנ׳`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
