import { useEffect, useMemo, useRef, useState } from "react";
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
  HelpCircle,
  Send,
  Save,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useTriggerAiProcessing,
  useUpdateRecording,
} from "@/lib/hooks/useRecordings";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useCreateEvent } from "@/lib/hooks/useEvents";
import type { Recording } from "@/lib/types/domain";
import type { RecordingAiOutput } from "@/lib/services/recordings";

interface Props {
  recording: Recording;
}

/** Empty defaults so the editable form always has the full shape on screen. */
const EMPTY_AI_OUTPUT: RecordingAiOutput = {
  summary: "",
  whatsapp_message: "",
  email: { subject: "", body: "" },
  tasks: [],
  events: [],
  key_decisions: [],
  questions: [],
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
    return {
      summary: raw.summary ?? "",
      whatsapp_message: raw.whatsapp_message ?? "",
      email: {
        subject: raw.email?.subject ?? "",
        body: raw.email?.body ?? "",
      },
      tasks: raw.tasks ?? [],
      events: raw.events ?? [],
      key_decisions: raw.key_decisions ?? [],
      questions: raw.questions ?? [],
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

  const onTrigger = () => trigger.mutate(recording.id);
  const onSave = () => {
    updateRecording.mutate({
      recordingId: recording.id,
      patch: {
        ai_output: draft as unknown as Recording["ai_output"],
      },
    });
  };

  // -------- empty state: never processed -----------------------------------
  if (!recording.ai_output && aiStatus !== "pending") {
    const errorBanner =
      aiStatus === "error" && recording.error_message ? (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 inline-flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{recording.error_message}</span>
        </div>
      ) : null;
    return (
      <section className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          עיבוד AI
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          Claude מסכם את השיחה ומציע הודעות מעקב, משימות, אירועים, החלטות
          ושאלות. כל פריט ניתן לעריכה ולאישור ידני לפני שהוא נכנס למערכת.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={trigger.isPending}
            onClick={onTrigger}
          >
            {trigger.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> מנתחת…
              </span>
            ) : (
              "הפעלי עיבוד AI"
            )}
          </button>
          {trigger.isPending && (
            <span className="text-[11px] text-ink-500">
              לוקח 10–30 שניות לרוב.
            </span>
          )}
        </div>
        {errorBanner}
      </section>
    );
  }

  // -------- in-flight state -------------------------------------------------
  if (aiStatus === "pending" && !recording.ai_output) {
    return (
      <section className="rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-1 inline-flex items-center gap-2 text-xs text-ink-700">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
        Claude מנתחת את השיחה…
      </section>
    );
  }

  // -------- main editable view ---------------------------------------------
  return (
    <section className="rounded-md border border-ink-200 bg-white px-3 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          עיבוד AI
          {recording.ai_output_at && (
            <span className="text-[10px] text-ink-400 font-normal">
              · נותח {formatRelative(recording.ai_output_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
            disabled={trigger.isPending}
            className="btn-outline !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
            title="עיבוד מחדש (יחליף את הניתוח הנוכחי)"
          >
            {trigger.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            עיבוד מחדש
          </button>
        </div>
      </div>

      <SummarySection
        value={draft.summary}
        onChange={(v) => setDraft((d) => ({ ...d, summary: v }))}
      />

      <WhatsAppSection
        value={draft.whatsapp_message}
        onChange={(v) => setDraft((d) => ({ ...d, whatsapp_message: v }))}
      />

      <EmailSection
        subject={draft.email.subject}
        body={draft.email.body}
        onChange={(subject, body) =>
          setDraft((d) => ({ ...d, email: { subject, body } }))
        }
      />

      <TasksSection
        recording={recording}
        items={draft.tasks}
        onChange={(items) => setDraft((d) => ({ ...d, tasks: items }))}
      />

      <EventsSection
        recording={recording}
        items={draft.events}
        onChange={(items) => setDraft((d) => ({ ...d, events: items }))}
      />

      <KeyDecisionsSection
        items={draft.key_decisions}
        onChange={(items) => setDraft((d) => ({ ...d, key_decisions: items }))}
      />

      <QuestionsSection
        items={draft.questions}
        onChange={(items) => setDraft((d) => ({ ...d, questions: items }))}
      />
    </section>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────

function SummarySection({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Pane icon={<Lightbulb className="w-3.5 h-3.5 text-primary-600" />} label="סיכום">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(3, Math.min(10, Math.ceil(value.length / 70)))}
        className="field min-h-[80px] resize-y text-sm"
        placeholder="סיכום השיחה"
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
  const createTask = useCreateTask();
  const [createdIndices, setCreatedIndices] = useState<Set<number>>(new Set());

  const onCreateOne = async (i: number) => {
    const item = items[i];
    if (!item?.title.trim()) return;
    try {
      await createTask.mutateAsync({
        title: item.title,
        description: item.due_hint
          ? `מתוך הקלטה: ${recording.title ?? ""} · רמז דד-ליין: ${item.due_hint}`
          : `מתוך הקלטה: ${recording.title ?? ""}`,
        urgency: priorityToUrgency(item.priority ?? "normal"),
      });
      setCreatedIndices((s) => new Set(s).add(i));
    } catch (err) {
      console.error("create task from ai failed:", err);
    }
  };

  return (
    <Pane
      icon={<CheckSquare className="w-3.5 h-3.5 text-primary-600" />}
      label={`משימות (${items.length})`}
    >
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-500">לא זוהו משימות בשיחה.</p>
      ) : (
        <div className="space-y-2">
          {items.map((task, i) => (
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
                <select
                  value={task.priority ?? "normal"}
                  onChange={(e) =>
                    onChange(
                      items.map((it, j) =>
                        j === i
                          ? {
                              ...it,
                              priority: e.target.value as "low" | "normal" | "high",
                            }
                          : it
                      )
                    )
                  }
                  className="field !py-0.5 !px-1 text-[11px] w-auto"
                >
                  <option value="low">נמוכה</option>
                  <option value="normal">רגילה</option>
                  <option value="high">גבוהה</option>
                </select>
                {task.speaker_name && (
                  <span className="text-[11px] text-ink-500">
                    דובר: {task.speaker_name}
                  </span>
                )}
                {task.due_hint && (
                  <span className="text-[11px] text-ink-500">
                    דד-ליין: {task.due_hint}
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  {createdIndices.has(i) ? (
                    <span className="text-[11px] text-success-700 inline-flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> נוצרה
                    </span>
                  ) : (
                    <ActionBtn
                      onClick={() => onCreateOne(i)}
                      icon={<CheckSquare className="w-3 h-3" />}
                      disabled={createTask.isPending || !task.title.trim()}
                    >
                      צור משימה
                    </ActionBtn>
                  )}
                  <ActionBtn
                    onClick={() =>
                      onChange(items.filter((_, j) => j !== i))
                    }
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

  return (
    <Pane
      icon={<CalendarPlus className="w-3.5 h-3.5 text-primary-600" />}
      label={`אירועים (${items.length})`}
    >
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-500">לא זוהו אירועים בשיחה.</p>
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

function KeyDecisionsSection({
  items,
  onChange,
}: {
  items: RecordingAiOutput["key_decisions"];
  onChange: (items: RecordingAiOutput["key_decisions"]) => void;
}) {
  return (
    <Pane
      icon={<Lightbulb className="w-3.5 h-3.5 text-warning-500" />}
      label={`החלטות מרכזיות (${items.length})`}
    >
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-500">לא זוהו החלטות בשיחה.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((d, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input
                value={d.text}
                onChange={(e) =>
                  onChange(
                    items.map((it, j) =>
                      j === i ? { text: e.target.value } : it
                    )
                  )
                }
                className="field !py-1 text-sm flex-1"
                dir="auto"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-ink-400 hover:text-danger-600 text-xs px-1"
                title="הסר"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Pane>
  );
}

function QuestionsSection({
  items,
  onChange,
}: {
  items: RecordingAiOutput["questions"];
  onChange: (items: RecordingAiOutput["questions"]) => void;
}) {
  return (
    <Pane
      icon={<HelpCircle className="w-3.5 h-3.5 text-primary-600" />}
      label={`שאלות פתוחות (${items.length})`}
    >
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-500">לא זוהו שאלות פתוחות.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((q, i) => (
            <li key={i} className="rounded-md border border-ink-200 px-2.5 py-1.5 space-y-1">
              <input
                value={q.question}
                onChange={(e) =>
                  onChange(
                    items.map((it, j) =>
                      j === i ? { ...it, question: e.target.value } : it
                    )
                  )
                }
                className="field !py-1 text-sm"
                placeholder="השאלה"
                dir="auto"
              />
              {q.context && (
                <input
                  value={q.context}
                  onChange={(e) =>
                    onChange(
                      items.map((it, j) =>
                        j === i ? { ...it, context: e.target.value } : it
                      )
                    )
                  }
                  className="field !py-0.5 !px-1 text-[11px]"
                  placeholder="הקשר / רקע"
                  dir="auto"
                />
              )}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-[11px] text-ink-500 hover:text-danger-600"
              >
                הסר
              </button>
            </li>
          ))}
        </ul>
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
