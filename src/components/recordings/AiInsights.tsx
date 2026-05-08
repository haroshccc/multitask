import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Mail,
  MessageCircle,
  CheckSquare,
  CalendarPlus,
  Lightbulb,
  Send,
  Save,
  FileText,
  AlignLeft,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useTriggerAiProcessing,
  useUpdateRecording,
  useAskRecordingFreeText,
} from "@/lib/hooks/useRecordings";
import {
  TaskEditModal,
  type TaskCreateDraft,
} from "@/components/tasks/TaskEditModal";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useCreateEvent } from "@/lib/hooks/useEvents";
import type { Recording } from "@/lib/types/domain";
import type { RecordingAiOutput } from "@/lib/services/recordings";

interface Props {
  recording: Recording;
}

/** Empty defaults so the editable form always has the full shape on screen. */
const EMPTY_AI_OUTPUT: RecordingAiOutput = {
  short_summary: "",
  long_summary: "",
  whatsapp_message: "",
  email: { subject: "", body: "" },
  tasks: [],
  events: [],
};

export function AiInsights({ recording }: Props) {
  const trigger = useTriggerAiProcessing();
  const updateRecording = useUpdateRecording();
  const aiStatus = recording.ai_status;

  // Local editable copy of the AI output. Resets every time the server-side
  // recording row changes (e.g. when the user clicks "עיבוד מחדש" and a new
  // result lands).
  const serverOutput = useMemo<RecordingAiOutput>(() => {
    const raw = recording.ai_output as unknown as RecordingAiOutput | null;
    if (!raw) return EMPTY_AI_OUTPUT;
    // Backward-compat: if the row was generated before we split summary
    // into short/long, fall back the old `summary` text into long_summary so
    // existing data still renders.
    const rawAny = raw as unknown as RecordingAiOutput & { summary?: string };
    return {
      short_summary: raw.short_summary ?? "",
      long_summary: raw.long_summary ?? rawAny.summary ?? "",
      whatsapp_message: raw.whatsapp_message ?? "",
      email: {
        subject: raw.email?.subject ?? "",
        body: raw.email?.body ?? "",
      },
      tasks: raw.tasks ?? [],
      events: raw.events ?? [],
    };
  }, [recording.ai_output, recording.id]);

  const [draft, setDraft] = useState<RecordingAiOutput>(serverOutput);
  const lastServerRef = useRef<RecordingAiOutput>(serverOutput);
  useEffect(() => {
    // Adopt new server values only when the user hasn't started editing.
    // After they touch any field, we keep their draft until they save or
    // explicitly re-run the analysis.
    if (sameOutput(draft, lastServerRef.current)) {
      setDraft(serverOutput);
    }
    lastServerRef.current = serverOutput;
  }, [serverOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(
    () => !sameOutput(draft, serverOutput),
    [draft, serverOutput]
  );

  // Toolbar tab — which AI section is expanded as the "main banner". One at
  // a time keeps the UI compact instead of stacking 6 long sections.
  type AiTab =
    | "short_summary"
    | "long_summary"
    | "whatsapp"
    | "email"
    | "tasks"
    | "events"
    | "free_text";
  const [activeTab, setActiveTab] = useState<AiTab>("short_summary");

  const onTrigger = () =>
    trigger.mutate({ recordingId: recording.id });
  const onSave = () => {
    updateRecording.mutate({
      recordingId: recording.id,
      patch: {
        ai_output: draft as unknown as Recording["ai_output"],
      },
    });
  };

  const errorBanner =
    aiStatus === "error" && recording.error_message ? (
      <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 inline-flex items-start gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span className="break-words">{recording.error_message}</span>
      </div>
    ) : null;

  // The form is always editable — even before AI runs the user can fill any
  // section by hand. AI augments the same form when triggered. After AI we
  // keep all "+" buttons visible so missed items can still be added manually.
  // -------- main editable view ---------------------------------------------
  return (
    <section className="rounded-md border border-ink-200 bg-white px-3 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          עיבוד
          {recording.ai_output_at && (
            <span className="text-[10px] text-ink-400 font-normal">
              · AI נותח {formatRelative(recording.ai_output_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {dirty && (
            <button
              type="button"
              onClick={onSave}
              disabled={updateRecording.isPending}
              className="btn-primary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
              title="שמירת השינויים שלך"
            >
              <Save className="w-3 h-3" />
              שמירה
            </button>
          )}
          <button
              type="button"
              onClick={onTrigger}
              disabled={
                trigger.isPending ||
                aiStatus === "pending" ||
                !recording.transcript_text
              }
              className="btn-outline !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
              title={
                !recording.transcript_text
                  ? "צריכה תמלול לפני שClaude יכולה לעבד"
                  : recording.ai_output
                  ? "הפעלת AI מחדש (יחליף את הניתוח הנוכחי)"
                  : "Claude מסכם וממלא את הסקציות אוטומטית"
              }
            >
              {trigger.isPending || aiStatus === "pending" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {recording.ai_output ? "עיבוד AI מחדש" : "הפעלת AI"}
            </button>
        </div>
      </div>

      {!recording.ai_output && aiStatus !== "pending" && (
        <p className="text-[11px] text-ink-500 leading-relaxed">
          ניתן למלא ידנית כל סקציה, או ללחוץ "הפעלת AI" וClaude ימלא הצעות
          שאת תוכלי לערוך / להוסיף עוד פריטים.
        </p>
      )}

      {errorBanner}

      {/* Tab toolbar — one icon per AI section. Click expands that section
          as the main banner; the others fold away to keep the surface tidy. */}
      <div className="flex items-center gap-1 flex-wrap border-b border-ink-200 pb-2">
        <AiTabButton
          icon={<FileText className="w-3.5 h-3.5" />}
          label="סיכום קצר"
          active={activeTab === "short_summary"}
          filled={!!draft.short_summary.trim()}
          onClick={() => setActiveTab("short_summary")}
        />
        <AiTabButton
          icon={<AlignLeft className="w-3.5 h-3.5" />}
          label="סיכום ארוך"
          active={activeTab === "long_summary"}
          filled={!!draft.long_summary.trim()}
          onClick={() => setActiveTab("long_summary")}
        />
        <AiTabButton
          icon={<MessageCircle className="w-3.5 h-3.5" />}
          label="WhatsApp"
          active={activeTab === "whatsapp"}
          filled={!!draft.whatsapp_message.trim()}
          onClick={() => setActiveTab("whatsapp")}
        />
        <AiTabButton
          icon={<Mail className="w-3.5 h-3.5" />}
          label="מייל"
          active={activeTab === "email"}
          filled={!!(draft.email.subject.trim() || draft.email.body.trim())}
          onClick={() => setActiveTab("email")}
        />
        <AiTabButton
          icon={<CheckSquare className="w-3.5 h-3.5" />}
          label="משימות"
          count={draft.tasks.length}
          active={activeTab === "tasks"}
          filled={draft.tasks.length > 0}
          onClick={() => setActiveTab("tasks")}
        />
        <AiTabButton
          icon={<CalendarPlus className="w-3.5 h-3.5" />}
          label="אירועים"
          count={draft.events.length}
          active={activeTab === "events"}
          filled={draft.events.length > 0}
          onClick={() => setActiveTab("events")}
        />
        <AiTabButton
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="שאלה חופשית"
          active={activeTab === "free_text"}
          filled={false}
          onClick={() => setActiveTab("free_text")}
        />
      </div>

      {activeTab === "short_summary" && (
        <SummaryTextSection
          label="סיכום קצר"
          placeholder="משפט-שניים שמסכמים את השיחה"
          rowsHint={3}
          value={draft.short_summary}
          onChange={(v) => setDraft((d) => ({ ...d, short_summary: v }))}
        />
      )}
      {activeTab === "long_summary" && (
        <SummaryTextSection
          label="סיכום ארוך"
          placeholder="סיכום מפורט — נקודות מרכזיות, החלטות, שאלות פתוחות"
          rowsHint={6}
          value={draft.long_summary}
          onChange={(v) => setDraft((d) => ({ ...d, long_summary: v }))}
        />
      )}
      {activeTab === "whatsapp" && (
        <WhatsAppSection
          value={draft.whatsapp_message}
          onChange={(v) => setDraft((d) => ({ ...d, whatsapp_message: v }))}
        />
      )}
      {activeTab === "email" && (
        <EmailSection
          subject={draft.email.subject}
          body={draft.email.body}
          onChange={(subject, body) =>
            setDraft((d) => ({ ...d, email: { subject, body } }))
          }
        />
      )}
      {activeTab === "tasks" && (
        <TasksSection
          recording={recording}
          items={draft.tasks}
          onChange={(items) => setDraft((d) => ({ ...d, tasks: items }))}
        />
      )}
      {activeTab === "events" && (
        <EventsSection
          recording={recording}
          items={draft.events}
          onChange={(items) => setDraft((d) => ({ ...d, events: items }))}
        />
      )}
      {activeTab === "free_text" && (
        <FreeTextSection recording={recording} />
      )}
    </section>
  );
}

/**
 * Small toolbar button for the AI section tabs. Has 3 visual states:
 *  - `active`: ring + bg, used on the currently-open section
 *  - `filled`: blue dot indicator showing the section already has content
 *  - default: muted icon
 *
 * `count` is shown as a tiny number badge for sections that hold a list
 * (tasks, events).
 */
function AiTabButton({
  icon,
  label,
  count,
  active,
  filled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  filled: boolean;
  onClick: () => void;
}) {
  // Underline rule (per design feedback):
  //  - selected → yellow bar (overrides orange)
  //  - filled but not selected → orange bar
  //  - empty → no bar
  // Counts as "filled" when a list section has items, OR when a text section
  // has any non-blank content (handled by the caller).
  const showFilled = filled || (count !== undefined && count > 0);
  const underlineClass = active
    ? "bg-accent-yellow"
    : showFilled
    ? "bg-accent-orange"
    : "bg-transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "relative inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] transition-colors",
        active
          ? "text-ink-900"
          : "text-ink-600 hover:text-ink-900"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "ms-0.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[9px] font-semibold tabular-nums px-1",
            active
              ? "bg-primary-500 text-white"
              : "bg-ink-200 text-ink-700"
          )}
        >
          {count}
        </span>
      )}
      <span
        className={cn(
          "absolute inset-x-1 -bottom-0.5 h-0.5 rounded-full transition-colors",
          underlineClass
        )}
        aria-hidden
      />
    </button>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────

function SummaryTextSection({
  label,
  placeholder,
  rowsHint,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  rowsHint: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Pane icon={<Lightbulb className="w-3.5 h-3.5 text-primary-600" />} label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(rowsHint, Math.min(20, Math.ceil(value.length / 70)))}
        className="field min-h-[80px] resize-y text-sm"
        placeholder={placeholder}
        dir="auto"
      />
    </Pane>
  );
}

function WhatsAppSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user can manually select instead */
    }
  };
  const onWhatsAppLink = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(value)}`;
    window.open(url, "_blank", "noopener");
  };
  return (
    <Pane
      icon={<MessageCircle className="w-3.5 h-3.5 text-success-600" />}
      label="הודעת WhatsApp"
      actions={
        <>
          <ActionBtn onClick={onCopy} icon={copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}>
            {copied ? "הועתק" : "העתקה"}
          </ActionBtn>
          <ActionBtn onClick={onWhatsAppLink} icon={<Send className="w-3 h-3" />} disabled={!value.trim()}>
            פתחי ב-WhatsApp
          </ActionBtn>
        </>
      }
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="field text-sm resize-y"
        placeholder="הודעת מעקב"
        dir="auto"
      />
    </Pane>
  );
}

function EmailSection({
  subject,
  body,
  onChange,
}: {
  subject: string;
  body: string;
  onChange: (subject: string, body: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const onMailto = () => {
    const href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };
  return (
    <Pane
      icon={<Mail className="w-3.5 h-3.5 text-primary-600" />}
      label="טיוטת מייל"
      actions={
        <>
          <ActionBtn onClick={onCopy} icon={copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}>
            {copied ? "הועתק" : "העתקה"}
          </ActionBtn>
          <ActionBtn onClick={onMailto} icon={<Send className="w-3 h-3" />} disabled={!subject.trim() && !body.trim()}>
            פתחי במייל
          </ActionBtn>
        </>
      }
    >
      <input
        type="text"
        value={subject}
        onChange={(e) => onChange(e.target.value, body)}
        className="field text-sm"
        placeholder="נושא"
        dir="auto"
      />
      <textarea
        value={body}
        onChange={(e) => onChange(subject, e.target.value)}
        rows={5}
        className="field text-sm resize-y mt-1"
        placeholder="גוף המייל"
        dir="auto"
      />
    </Pane>
  );
}

function TasksSection({
  recording,
  items,
  onChange,
}: {
  recording: Recording;
  items: RecordingAiOutput["tasks"];
  onChange: (items: RecordingAiOutput["tasks"]) => void;
}) {
  const navigate = useNavigate();
  const { data: taskLists = [] } = useTaskLists();
  const createTask = useCreateTask();
  // Track which AI suggestions have already been turned into real tasks so we
  // can show "נוצרה" + the new task id instead of a stale "צור משימה".
  const [createdByIndex, setCreatedByIndex] = useState<Record<number, string>>(
    {}
  );
  // Open TaskEditModal in either CREATE mode (no taskId, with a draft) or
  // EDIT mode (taskId set, draft cleared).
  const [editorState, setEditorState] = useState<{
    sourceIndex: number;
    taskId: string | null;
    draft: TaskCreateDraft | null;
  } | null>(null);

  // Bulk-create state machine.
  // - 'idle' = no panel showing
  // - 'pick' = list-picker open, user choosing destination
  // - 'creating' = `createTask` calls in flight
  // - 'done' = banner shown with count + "go to tasks"
  const [bulkState, setBulkState] = useState<
    | { kind: "idle" }
    | { kind: "pick" }
    | { kind: "creating"; total: number; done: number }
    | { kind: "done"; created: number; listId: string | null; listName: string }
  >({ kind: "idle" });
  const [bulkListId, setBulkListId] = useState<string | null>(null);

  const onCreateOne = (i: number) => {
    const item = items[i];
    if (!item?.title.trim()) return;
    setEditorState({
      sourceIndex: i,
      taskId: null,
      draft: {
        title: item.title,
        description: item.due_hint
          ? `מתוך הקלטה: ${recording.title ?? ""} · רמז דד-ליין: ${item.due_hint}`
          : `מתוך הקלטה: ${recording.title ?? ""}`,
        urgency: priorityToUrgency(item.priority ?? "normal"),
      },
    });
  };

  const onEditExisting = (i: number, taskId: string) => {
    setEditorState({ sourceIndex: i, taskId, draft: null });
  };

  const addBlank = () =>
    onChange([
      ...items,
      { title: "", priority: "normal", speaker_name: null, due_hint: null },
    ]);

  // Bulk-create every still-uncreated task that has a non-empty title, all to
  // the same picked task_list. We loop sequentially through useCreateTask so
  // optimistic-cache invalidation behaves like manually clicking each one.
  const onCreateAll = async () => {
    const targets = items
      .map((item, i) => ({ item, i }))
      .filter(
        ({ item, i }) =>
          item.title.trim().length > 0 && !createdByIndex[i]
      );
    if (targets.length === 0) {
      setBulkState({ kind: "idle" });
      return;
    }
    setBulkState({ kind: "creating", total: targets.length, done: 0 });
    const created: Record<number, string> = {};
    let done = 0;
    for (const { item, i } of targets) {
      try {
        const t = await createTask.mutateAsync({
          title: item.title,
          description: item.due_hint
            ? `מתוך הקלטה: ${recording.title ?? ""} · רמז דד-ליין: ${item.due_hint}`
            : `מתוך הקלטה: ${recording.title ?? ""}`,
          urgency: priorityToUrgency(item.priority ?? "normal"),
          task_list_id: bulkListId,
        });
        created[i] = t.id;
      } catch (err) {
        console.error("bulk create task failed:", err);
      }
      done += 1;
      setBulkState({ kind: "creating", total: targets.length, done });
    }
    setCreatedByIndex((prev) => ({ ...prev, ...created }));
    const list = taskLists.find((l) => l.id === bulkListId);
    setBulkState({
      kind: "done",
      created: Object.keys(created).length,
      listId: bulkListId,
      listName: list?.name ?? "ברירת מחדל",
    });
  };

  const uncreatedCount = items.filter(
    (it, i) => it.title.trim() && !createdByIndex[i]
  ).length;

  return (
    <Pane
      icon={<CheckSquare className="w-3.5 h-3.5 text-primary-600" />}
      label={`משימות (${items.length})`}
      actions={
        <>
          {uncreatedCount >= 2 && bulkState.kind === "idle" && (
            <ActionBtn
              onClick={() => setBulkState({ kind: "pick" })}
              icon={<Send className="w-3 h-3" />}
            >
              צור את כולן ({uncreatedCount})
            </ActionBtn>
          )}
          <ActionBtn onClick={addBlank} icon={<span className="text-[11px]">+</span>}>
            הוספת משימה
          </ActionBtn>
        </>
      }
    >
      {bulkState.kind === "pick" && (
        <div className="rounded-md border border-primary-200 bg-primary-50/40 px-3 py-2 space-y-2">
          <div className="text-[11px] font-semibold text-ink-700">
            לאיזו רשימה לשייך את כל {uncreatedCount} המשימות?
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={bulkListId ?? ""}
              onChange={(e) => setBulkListId(e.target.value || null)}
              className="field !py-1 !px-2 text-xs flex-1 min-w-[160px]"
            >
              <option value="">— ללא רשימה —</option>
              {taskLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onCreateAll}
              className="btn-primary !py-1 !px-2 !text-[11px]"
            >
              צור הכל
            </button>
            <button
              type="button"
              onClick={() => setBulkState({ kind: "idle" })}
              className="btn-outline !py-1 !px-2 !text-[11px]"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {bulkState.kind === "creating" && (
        <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-[11px] text-ink-700 inline-flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          יוצרת משימות… {bulkState.done} מתוך {bulkState.total}
        </div>
      )}

      {bulkState.kind === "done" && (
        <div className="rounded-md border border-success-300 bg-success-50 px-3 py-2 space-y-1.5">
          <div className="text-xs text-success-800 inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            נוצרו {bulkState.created} משימות חדשות ברשימה "{bulkState.listName}".
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/app/tasks")}
              className="btn-primary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
            >
              פתחי מסך משימות לעריכה מלאה
            </button>
            <button
              type="button"
              onClick={() => setBulkState({ kind: "idle" })}
              className="btn-outline !py-1 !px-2 !text-[11px]"
            >
              סגירה והמשך עיבוד
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[11px] text-ink-500">
          לחיצי "הוספת משימה" או הפעילי AI כדי לקבל הצעות.
        </p>
      ) : (
        <SpeakerGroupedTasks
          items={items}
          recording={recording}
          createdByIndex={createdByIndex}
          onChange={onChange}
          onCreateOne={onCreateOne}
          onEditExisting={onEditExisting}
        />
      )}
      <TaskEditModal
        taskId={editorState?.taskId ?? null}
        createDraft={editorState?.draft ?? null}
        onClose={() => setEditorState(null)}
        onCreated={(taskId) => {
          if (editorState) {
            const idx = editorState.sourceIndex;
            setCreatedByIndex((prev) => ({ ...prev, [idx]: taskId }));
          }
        }}
      />
    </Pane>
  );
}

function EventsSection({
  recording,
  items,
  onChange,
}: {
  recording: Recording;
  items: RecordingAiOutput["events"];
  onChange: (items: RecordingAiOutput["events"]) => void;
}) {
  const createEvent = useCreateEvent();
  const [createdIndices, setCreatedIndices] = useState<Set<number>>(new Set());

  const onCreateOne = async (i: number) => {
    const item = items[i];
    if (!item?.title.trim()) return;
    const startsAt = item.date_iso
      ? new Date(item.date_iso).toISOString()
      : new Date().toISOString();
    const duration = item.duration_minutes ?? 30;
    const endsAt = new Date(
      new Date(startsAt).getTime() + duration * 60_000
    ).toISOString();
    try {
      await createEvent.mutateAsync({
        title: item.title,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: false,
        description: `מתוך הקלטה: ${recording.title ?? ""}`,
      });
      setCreatedIndices((s) => new Set(s).add(i));
    } catch (err) {
      console.error("create event from ai failed:", err);
    }
  };

  const addBlank = () =>
    onChange([
      ...items,
      { title: "", date_iso: null, duration_minutes: 30, speaker_name: null },
    ]);

  return (
    <Pane
      icon={<CalendarPlus className="w-3.5 h-3.5 text-primary-600" />}
      label={`אירועים (${items.length})`}
      actions={
        <ActionBtn onClick={addBlank} icon={<span className="text-[11px]">+</span>}>
          הוספת אירוע
        </ActionBtn>
      }
    >
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-500">
          לחיצי "הוספת אירוע" או הפעילי AI כדי לקבל הצעות.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((ev, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md border px-2.5 py-1.5 space-y-1",
                createdIndices.has(i)
                  ? "border-success-300 bg-success-50"
                  : "border-ink-200"
              )}
            >
              <input
                value={ev.title}
                onChange={(e) =>
                  onChange(
                    items.map((it, j) =>
                      j === i ? { ...it, title: e.target.value } : it
                    )
                  )
                }
                className="field !py-1 text-sm"
                placeholder="כותרת האירוע"
                dir="auto"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="datetime-local"
                  value={isoToLocalInput(ev.date_iso ?? null)}
                  onChange={(e) =>
                    onChange(
                      items.map((it, j) =>
                        j === i
                          ? { ...it, date_iso: localInputToIso(e.target.value) }
                          : it
                      )
                    )
                  }
                  className="field !py-0.5 !px-1 text-[11px] w-auto"
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={ev.duration_minutes ?? 30}
                  onChange={(e) =>
                    onChange(
                      items.map((it, j) =>
                        j === i
                          ? { ...it, duration_minutes: Number(e.target.value) || 30 }
                          : it
                      )
                    )
                  }
                  className="field !py-0.5 !px-1 text-[11px] w-16"
                />
                <span className="text-[11px] text-ink-500">דק׳</span>
                <div className="ms-auto flex items-center gap-1">
                  {createdIndices.has(i) ? (
                    <span className="text-[11px] text-success-700 inline-flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> נוצר
                    </span>
                  ) : (
                    <ActionBtn
                      onClick={() => onCreateOne(i)}
                      icon={<CalendarPlus className="w-3 h-3" />}
                      disabled={createEvent.isPending || !ev.title.trim()}
                    >
                      צור אירוע
                    </ActionBtn>
                  )}
                  <ActionBtn
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                    icon={<span className="text-[11px]">×</span>}
                  >
                    הסר
                  </ActionBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Pane>
  );
}

function FreeTextSection({ recording }: { recording: Recording }) {
  const ask = useAskRecordingFreeText();
  const [text, setText] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onAsk = async () => {
    if (!text.trim()) return;
    setError(null);
    setResponse(null);
    try {
      const res = await ask.mutateAsync({
        recordingId: recording.id,
        question: text.trim(),
      });
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעיבוד הבקשה");
    }
  };

  return (
    <Pane
      icon={<Sparkles className="w-3.5 h-3.5 text-primary-600" />}
      label="שאלה חופשית"
    >
      <p className="text-[11px] text-ink-500 leading-relaxed">
        שאלי כל שאלה על ההקלטה — לדוגמה: &quot;מה הוחלט לגבי X?&quot; או
        &quot;תסכם רק את נושא Y&quot;.
      </p>
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="הקלידי בקשה חופשית…"
          className="field flex-1 min-h-[64px] resize-y text-sm"
          dir="rtl"
          disabled={ask.isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onAsk();
            }
          }}
        />
        <button
          type="button"
          onClick={onAsk}
          disabled={!text.trim() || ask.isPending || !recording.transcript_text}
          className="btn-primary !py-1.5 !px-2 !text-xs shrink-0 inline-flex items-center gap-1"
          title={!recording.transcript_text ? "צריכה תמלול לפני עיבוד" : ""}
        >
          {ask.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          עבד בקשה
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 inline-flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {response && (
        <div
          className="rounded-md border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 whitespace-pre-wrap leading-relaxed"
          dir="auto"
        >
          {response}
        </div>
      )}
    </Pane>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────

function Pane({
  icon,
  label,
  actions,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-ink-100 bg-ink-50/40 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-ink-700 inline-flex items-center gap-1.5">
          {icon}
          {label}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function ActionBtn({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-outline !py-0.5 !px-1.5 !text-[11px] inline-flex items-center gap-1"
    >
      {icon}
      {children}
    </button>
  );
}

// ─── small utils ──────────────────────────────────────────────────────────

interface TaskGroup {
  key: string;
  label: string;
  indices: number[];
}

/**
 * Renders the speaker-grouped tasks UI: a chip filter at the top picks
 * which speakers to show, and each shown speaker can flip between the
 * existing task-rows view ("משימות") and a copy-paste-friendly text
 * summary ("טקסט") with WhatsApp / mail / copy buttons. State here is
 * intentionally local — it doesn't persist across recording switches,
 * which is what we want (each conversation starts with everyone visible).
 */
function SpeakerGroupedTasks({
  items,
  recording,
  createdByIndex,
  onChange,
  onCreateOne,
  onEditExisting,
}: {
  items: RecordingAiOutput["tasks"];
  recording: Recording;
  createdByIndex: Record<number, string>;
  onChange: (items: RecordingAiOutput["tasks"]) => void;
  onCreateOne: (i: number) => void;
  onEditExisting: (i: number, taskId: string) => void;
}) {
  const groups = useMemo(() => groupTasksBySpeaker(items), [items]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState<Record<string, "tasks" | "text">>({});

  const toggleVisibility = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setMode = (key: string, mode: "tasks" | "text") =>
    setModes((m) => ({ ...m, [key]: mode }));

  return (
    <div className="space-y-3">
      {groups.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap text-[11px] text-ink-500">
          <span className="px-1">דוברים:</span>
          {groups.map((g) => {
            const isHidden = hidden.has(g.key);
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => toggleVisibility(g.key)}
                className={cn(
                  "rounded-full border px-2 py-0.5 transition-colors",
                  isHidden
                    ? "border-ink-200 bg-white text-ink-400 line-through"
                    : "border-primary-300 bg-primary-50 text-primary-800"
                )}
              >
                {g.label} · {g.indices.length}
              </button>
            );
          })}
        </div>
      )}

      {groups.map((group) => {
        if (hidden.has(group.key)) return null;
        const mode = modes[group.key] ?? "tasks";
        const dotColor =
          group.key === "_self_"
            ? "bg-primary-500"
            : group.key === "_unassigned_"
            ? "bg-ink-300"
            : "bg-warning-500";
        const isOtherSide =
          group.key !== "_self_" && group.key !== "_unassigned_";
        return (
          <div key={group.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-[11px] font-semibold text-ink-600 inline-flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
                {group.label} · {group.indices.length}
              </div>
              <div className="inline-flex rounded-md border border-ink-200 overflow-hidden text-[10px]">
                <ModeTab
                  active={mode === "tasks"}
                  onClick={() => setMode(group.key, "tasks")}
                >
                  משימות
                </ModeTab>
                <ModeTab
                  active={mode === "text"}
                  onClick={() => setMode(group.key, "text")}
                >
                  טקסט
                </ModeTab>
              </div>
            </div>

            {mode === "tasks" ? (
              <>
                {group.indices.map((i) => (
                  <TaskRow
                    key={i}
                    index={i}
                    task={items[i]}
                    items={items}
                    onChange={onChange}
                    createdId={createdByIndex[i]}
                    onCreate={() => onCreateOne(i)}
                    onEdit={() => {
                      const id = createdByIndex[i];
                      if (id) onEditExisting(i, id);
                    }}
                  />
                ))}
              </>
            ) : (
              <TaskTextSummary
                group={group}
                items={items}
                recording={recording}
                isOtherSide={isOtherSide}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 transition-colors",
        active ? "bg-ink-900 text-white" : "bg-white text-ink-700 hover:bg-ink-50"
      )}
    >
      {children}
    </button>
  );
}

/** Renders the speaker's tasks as a numbered text block + send buttons. */
function TaskTextSummary({
  group,
  items,
  recording,
  isOtherSide,
}: {
  group: TaskGroup;
  items: RecordingAiOutput["tasks"];
  recording: Recording;
  isOtherSide: boolean;
}) {
  const speakerName =
    group.key === "_self_"
      ? null
      : group.key === "_unassigned_"
      ? null
      : group.key;
  const lines = group.indices
    .map((i) => items[i])
    .map((t, idx) => {
      const text = (t.title ?? "").trim();
      if (!text) return null;
      const due = t.due_hint ? ` (דד-ליין: ${t.due_hint})` : "";
      return `${idx + 1}. ${text}${due}`;
    })
    .filter((s): s is string => Boolean(s));
  const greeting = speakerName ? `היי ${speakerName},` : null;
  const heading =
    group.key === "_self_"
      ? "המשימות שלי מהשיחה:"
      : speakerName
      ? "אלה המשימות שעלו בשיחה שלנו ואני זקוקה לך עליהן:"
      : "משימות נוספות מהשיחה:";
  const body = [greeting, heading, ...lines]
    .filter(Boolean)
    .join("\n");
  const [draft, setDraft] = useState(body);
  // Re-seed when the underlying tasks change (server response or user edit).
  useEffect(() => {
    setDraft(body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  const [copied, setCopied] = useState(false);

  const onWhatsApp = () => {
    if (!draft.trim()) return;
    const url = `https://wa.me/?text=${encodeURIComponent(draft)}`;
    window.open(url, "_blank", "noopener");
  };
  const onMail = () => {
    if (!draft.trim()) return;
    const subject = `משימות מתוך השיחה: ${recording.title ?? ""}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(draft)}`;
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (lines.length === 0) {
    return (
      <p className="text-[11px] text-ink-500 px-1">
        אין משימות מסומנות לדובר זה.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-ink-200 bg-white px-2.5 py-2 space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.max(4, lines.length + 2)}
        className="field text-xs resize-y leading-relaxed"
        dir="auto"
      />
      <div className="flex items-center gap-1 flex-wrap">
        {isOtherSide && (
          <>
            <ActionBtn
              onClick={onWhatsApp}
              icon={<Send className="w-3 h-3" />}
              disabled={!draft.trim()}
            >
              WhatsApp
            </ActionBtn>
            <ActionBtn
              onClick={onMail}
              icon={<Mail className="w-3 h-3" />}
              disabled={!draft.trim()}
            >
              מייל
            </ActionBtn>
          </>
        )}
        <ActionBtn
          onClick={onCopy}
          icon={
            copied ? (
              <Check className="w-3 h-3 text-success-700" />
            ) : (
              <Copy className="w-3 h-3" />
            )
          }
          disabled={!draft.trim()}
        >
          {copied ? "הועתק" : "העתקה"}
        </ActionBtn>
      </div>
    </div>
  );
}

const SELF_TOKENS = ["אני", "myself", "me", "self"];

/**
 * Groups tasks for the משימות pane:
 *   _self_       — tasks attributed to the user ("אני" / "me" / matching name)
 *   _unassigned_ — speaker_name missing or unrecognised
 *   <speaker>    — one bucket per other-side speaker_name
 */
function groupTasksBySpeaker(items: RecordingAiOutput["tasks"]): TaskGroup[] {
  const order: string[] = [];
  const buckets: Record<string, TaskGroup> = {};
  const ensure = (key: string, label: string) => {
    if (!buckets[key]) {
      buckets[key] = { key, label, indices: [] };
      order.push(key);
    }
    return buckets[key];
  };
  for (let i = 0; i < items.length; i++) {
    const name = (items[i].speaker_name ?? "").trim();
    if (!name) {
      ensure("_unassigned_", "משימות ללא דובר").indices.push(i);
    } else if (SELF_TOKENS.some((t) => name.toLowerCase() === t)) {
      ensure("_self_", "המשימות שלי").indices.push(i);
    } else {
      ensure(name, `משימות עבור ${name}`).indices.push(i);
    }
  }
  // Stable ordering: _self_ first, then other speakers in encounter order,
  // _unassigned_ last so it doesn't push the meaningful groups down.
  return order
    .sort((a, b) => {
      const score = (k: string) =>
        k === "_self_" ? 0 : k === "_unassigned_" ? 2 : 1;
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;
      return order.indexOf(a) - order.indexOf(b);
    })
    .map((k) => buckets[k]);
}

function TaskRow({
  index,
  task,
  items,
  onChange,
  createdId,
  onCreate,
  onEdit,
}: {
  index: number;
  task: RecordingAiOutput["tasks"][number];
  items: RecordingAiOutput["tasks"];
  onChange: (items: RecordingAiOutput["tasks"]) => void;
  createdId: string | undefined;
  onCreate: () => void;
  onEdit: () => void;
}) {
  const i = index;
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5 space-y-1",
        createdId ? "border-success-300 bg-success-50" : "border-ink-200"
      )}
    >
      <input
        value={task.title}
        onChange={(e) =>
          onChange(
            items.map((it, j) =>
              j === i ? { ...it, title: e.target.value } : it
            )
          )
        }
        className="field !py-1 text-sm"
        placeholder="כותרת המשימה"
        dir="auto"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {task.due_hint && (
          <span className="text-[11px] text-ink-500">
            דד-ליין: {task.due_hint}
          </span>
        )}
        <div className="ms-auto flex items-center gap-1 flex-wrap justify-end">
          {createdId ? (
            <ActionBtn
              onClick={onEdit}
              icon={<Check className="w-3 h-3 text-success-700" />}
            >
              פתחי לעריכה
            </ActionBtn>
          ) : (
            <ActionBtn
              onClick={onCreate}
              icon={<CheckSquare className="w-3 h-3" />}
              disabled={!task.title.trim()}
            >
              צור משימה
            </ActionBtn>
          )}
          <ActionBtn
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            icon={<span className="text-[11px]">×</span>}
          >
            הסר
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

function priorityToUrgency(p: "low" | "normal" | "high"): number {
  if (p === "low") return 25;
  if (p === "high") return 75;
  return 50;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // datetime-local wants YYYY-MM-DDTHH:mm in LOCAL time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "כרגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function sameOutput(a: RecordingAiOutput, b: RecordingAiOutput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
