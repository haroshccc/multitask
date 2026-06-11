import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  FileAudio,
  FolderOpen,
  ListChecks,
  Loader2,
  MessageCircle,
  Mic,
  Phone,
  Plus,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import {
  useRecording,
  useTriggerAiProcessing,
  useUpdateRecording,
} from "@/lib/hooks/useRecordings";
import { useCreateRecordingList } from "@/lib/hooks/useRecordingLists";
import {
  useApplyFiling,
  planFromAiSuggestions,
  planHasFiling,
  type FilingSel,
} from "@/lib/hooks/useApplyFiling";
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
  /** All recording lists (folders) — for the inline quick-file picker. */
  lists: Array<{ id: string; name: string }>;
  /** All projects — for mapping AI filing suggestions. */
  projects: Array<{ id: string; name: string }>;
  /** Open the full filing wizard. */
  onFile: () => void;
}

type Phase =
  | "awaiting"
  | "transcribing"
  | "summarizing"
  | "ready"
  | "empty"
  | "error";

/** Per-source icon + colour tint so the feed is scannable at a glance. */
function sourceMeta(source: Recording["source"]): {
  Icon: LucideIcon;
  className: string;
} {
  switch (source) {
    case "call":
      return { Icon: Phone, className: "bg-sky-50 text-sky-600" };
    case "meeting":
      return { Icon: Users, className: "bg-violet-50 text-violet-600" };
    case "thought":
      return { Icon: Mic, className: "bg-amber-50 text-amber-600" };
    case "whatsapp":
      return { Icon: MessageCircle, className: "bg-emerald-50 text-emerald-600" };
    case "upload":
    case "recording":
      return { Icon: FileAudio, className: "bg-ink-100 text-ink-500" };
    default:
      return { Icon: Sparkles, className: "bg-primary-50 text-primary-600" };
  }
}

function derivePhase(recording: Recording, ai: RecordingAiOutput | null): Phase {
  const hasTranscript = !!recording.transcript_text?.trim();
  if (recording.status === "transcribing") return "transcribing";
  if (!hasTranscript && recording.status === "uploaded") return "awaiting";
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
  lists,
  projects,
  onFile,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const ai = (recording.ai_output as RecordingAiOutput | null) ?? null;
  const phase = derivePhase(recording, ai);
  const { Icon: SourceIcon, className: sourceClass } = sourceMeta(recording.source);

  return (
    <article
      className={cn(
        "rounded-xl border bg-white shadow-soft transition-all hover:shadow-lift",
        isUnfiled
          ? "border-amber-300 ring-1 ring-amber-100"
          : "border-ink-200 hover:border-ink-300",
      )}
    >
      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              sourceClass,
            )}
          >
            <SourceIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <InlineTitle recording={recording} />
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-500">
              <span>
                {format(new Date(recording.created_at), "HH:mm", { locale: he })}
              </span>
              {recording.duration_seconds != null && (
                <span className="text-ink-300">·</span>
              )}
              {recording.duration_seconds != null && (
                <span>{formatDuration(recording.duration_seconds)}</span>
              )}
              <span className="text-ink-300">·</span>
              <SpeakerLine count={recording.speakers_count} />
            </div>
          </div>
        </div>

        {/* Body — depends on pipeline phase */}
        {phase === "awaiting" && (
          <PhaseLine
            spin={false}
            text="ממתינה לתמלול — פתחי ״הצג מקור״ כדי להתחיל."
          />
        )}
        {phase === "transcribing" && (
          <PhaseLine spin text="מתמללת את ההקלטה…" />
        )}
        {phase === "summarizing" && <PhaseLine spin text="מסכמת עם AI…" />}
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

        {/* Unfiled → quick filing (one-tap AI + folder picker) */}
        {isUnfiled && (
          <UnfiledActions
            recording={recording}
            ai={ai}
            lists={lists}
            projects={projects}
            onOpenWizard={onFile}
          />
        )}
      </div>

      {/* Source expander — full-width footer */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-center gap-1 border-t px-4 py-2",
          "text-[11px] font-medium text-ink-500 hover:text-primary-700 hover:bg-ink-50/60 transition-colors",
          expanded ? "border-ink-100 rounded-none" : "border-ink-100 rounded-b-xl",
        )}
      >
        <ChevronDown
          className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")}
        />
        {expanded ? "הסתר מקור" : "הצג מקור · אודיו ותמלול"}
      </button>

      {expanded && <SourceExpander recordingId={recording.id} fallback={recording} />}
    </article>
  );
}

function UnfiledActions({
  recording,
  ai,
  lists,
  projects,
  onOpenWizard,
}: {
  recording: Recording;
  ai: RecordingAiOutput | null;
  lists: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  onOpenWizard: () => void;
}) {
  const apply = useApplyFiling();
  const createList = useCreateRecordingList();
  const [busy, setBusy] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const aiPlan = useMemo(
    () => planFromAiSuggestions(ai, projects, lists),
    [ai, projects, lists],
  );
  const canOneTap = planHasFiling(aiPlan);

  const run = async (plan: Parameters<typeof apply>[1]) => {
    if (busy) return;
    setBusy(true);
    try {
      // Unfiled card → no existing assignments by definition.
      await apply(recording, plan, { existingAssignments: [] });
      // On success the row becomes "filed" and this card re-renders out of the
      // waiting section (component unmounts) — no need to reset `busy`.
    } catch (e) {
      console.error("quick file failed:", e);
      setBusy(false);
    }
  };

  const suggestedListName = ((sel: FilingSel | undefined): string | null => {
    if (!sel || sel.kind === "none") return null;
    if (sel.kind === "existing")
      return lists.find((l) => l.id === sel.id)?.name ?? null;
    return `${sel.name} (חדשה)`;
  })(aiPlan.list);
  const suggestedTags = aiPlan.tags?.slice(0, 3) ?? [];

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 space-y-2">
      {canOneTap ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-[11px] text-amber-800 leading-tight">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Sparkles className="w-3 h-3" />
              הצעת תיוק:
            </span>{" "}
            <span className="text-amber-700">
              {[suggestedListName, ...suggestedTags.map((t) => `#${t}`)]
                .filter(Boolean)
                .join(" · ") || "תגיות"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => run(aiPlan)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {busy ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              תייק
            </button>
            <button
              type="button"
              onClick={() => setShowFolders((v) => !v)}
              className="rounded-md px-1.5 py-1 text-[11px] text-amber-700 hover:bg-amber-100"
            >
              שנה
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-amber-800">
            תייק לתיקייה:
          </span>
          <button
            type="button"
            onClick={onOpenWizard}
            className="text-[11px] text-amber-700 hover:underline"
          >
            אשף מלא →
          </button>
        </div>
      )}

      {(showFolders || !canOneTap) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={busy}
              onClick={() => run({ list: { kind: "existing", id: l.id } })}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] text-ink-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 max-w-[10rem]"
            >
              <ListChecks className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="truncate">{l.name}</span>
            </button>
          ))}
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = newName.trim();
                if (n) {
                  setCreating(false);
                  setNewName("");
                  void run({ list: { kind: "new", name: n } });
                }
              }}
              className="inline-flex items-center gap-1"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => !newName.trim() && setCreating(false)}
                placeholder="תיקייה חדשה"
                className="field !py-1 !px-2 !text-[11px] w-32"
                dir="auto"
              />
              <button
                type="submit"
                disabled={!newName.trim() || busy || createList.isPending}
                className="rounded-md bg-amber-500 p-1 text-white disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-amber-300 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-100"
            >
              <Plus className="w-3 h-3" />
              תיקייה
            </button>
          )}
          {canOneTap && (
            <button
              type="button"
              onClick={onOpenWizard}
              className="text-[11px] text-amber-700 hover:underline ms-auto"
            >
              אשף מלא →
            </button>
          )}
        </div>
      )}
    </div>
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
          <button
            type="button"
            onClick={onOpenSource}
            className="text-[11px] font-medium text-primary-700 hover:underline"
          >
            {tasks.length > shownTasks.length
              ? `עוד ${tasks.length - shownTasks.length} · המרה למשימות ↓`
              : "המרה למשימות ↓"}
          </button>
        </div>
      )}

      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {events.map((e, i) => {
            const shortDate = safeShortDate(e.date_iso);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-violet-50 text-violet-700 px-2 py-0.5 text-[11px]"
                dir="auto"
              >
                <CalendarClock className="w-3 h-3" />
                {e.title}
                {shortDate && (
                  <span className="text-violet-400"> · {shortDate}</span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Format an (untrusted, AI-provided) date string, or null if unparseable. */
function safeShortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "d/M", { locale: he });
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
  const personal = count == null || count <= 1;
  return (
    <span className="inline-flex items-center gap-1">
      <Users className="w-3 h-3" />
      {personal ? "הקלטה אישית" : `${count} דוברים`}
    </span>
  );
}

function PhaseLine({ spin, text }: { spin: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-500 py-1">
      {spin && <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin" />}
      <span>{text}</span>
      {spin && <span className="flex-1 h-3 rounded bg-ink-100 animate-pulse" />}
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
