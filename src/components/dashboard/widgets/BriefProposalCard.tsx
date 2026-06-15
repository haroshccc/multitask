import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  CalendarPlus,
  CalendarClock,
  CalendarRange,
  GitBranch,
  CheckSquare,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import {
  useUpdateTask,
  useCompleteTask,
  useCreateEvent,
  useCreateTask,
  useRecordProposalDecision,
} from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import { ReorderDayCard } from "./BriefReorderDayCard";
import { DateTimeField } from "@/components/ui/DateField";
import type {
  DailyBrief,
  Proposal,
  ProposalDecision,
  ProposalKind,
  MoveTaskPayload,
  ScheduleTaskPayload,
  CreateEventPayload,
  ReorderDayPayload,
  CompleteTaskPayload,
  SplitTaskPayload,
} from "@/lib/types/domain";

const KIND_META: Record<
  ProposalKind,
  { icon: typeof CheckSquare; label: string; tone: string }
> = {
  move_task: {
    icon: CalendarClock,
    label: "העברת משימה",
    tone: "border-amber-200 bg-amber-50/50",
  },
  schedule_task: {
    icon: CalendarPlus,
    label: "תזמון משימה",
    tone: "border-primary-200 bg-primary-50/50",
  },
  create_event: {
    icon: CalendarRange,
    label: "אירוע חדש",
    tone: "border-violet-200 bg-violet-50/50",
  },
  reorder_day: {
    icon: GitBranch,
    label: "סידור היום",
    tone: "border-emerald-200 bg-emerald-50/50",
  },
  complete_task: {
    icon: CheckSquare,
    label: "סימון כבוצע",
    tone: "border-emerald-200 bg-emerald-50/50",
  },
  split_task: {
    icon: GitBranch,
    label: "פיצול משימה",
    tone: "border-rose-200 bg-rose-50/50",
  },
};

interface Props {
  proposal: Proposal;
  brief: DailyBrief;
  decision?: ProposalDecision;
}

/**
 * One proposal = one card. Approve/dismiss/edit buttons. Uses the right
 * domain mutation (useUpdateTask / useCreateEvent / useCompleteTask /
 * useCreateTask) based on proposal.kind, then writes the decision back to
 * the brief row.
 *
 * Design discipline: every action goes through `executeProposal` which is the
 * single point where we A) call the mutation B) record the decision. Anything
 * else would risk drift between "we did the thing" and "we noted that we did
 * the thing".
 */
export function ApplyProposalCard({ proposal, brief, decision }: Props) {
  // reorder_day has its own visual layout (day-agenda with per-row checkboxes
  // and inline time editors), so it bypasses the generic card.
  if (proposal.kind === "reorder_day") {
    return (
      <ReorderDayCard
        proposal={proposal as Proposal & { kind: "reorder_day"; payload: ReorderDayPayload }}
        brief={brief}
        decision={decision}
      />
    );
  }
  const meta = KIND_META[proposal.kind];
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();
  const recordDecision = useRecordProposalDecision();

  // Local "edited" payload — when the user opens the editor we copy the
  // proposal payload into state, then pass that copy to executeProposal on
  // approve. The original proposal stays untouched in the brief.
  const [editedPayload, setEditedPayload] = useState<Proposal["payload"]>(
    proposal.payload
  );

  const isApproved = decision?.state === "approved";
  const isDismissed = decision?.state === "dismissed";

  async function executeProposal(payload: Proposal["payload"]): Promise<{
    appliedTargetId?: string;
  }> {
    switch (proposal.kind) {
      case "move_task":
      case "schedule_task": {
        const p = payload as MoveTaskPayload | ScheduleTaskPayload;
        await updateTask.mutateAsync({
          taskId: p.task_id,
          patch: {
            scheduled_at: p.new_scheduled_at,
            ...(("duration_minutes" in p && p.duration_minutes != null)
              ? { duration_minutes: p.duration_minutes }
              : {}),
          },
        });
        return { appliedTargetId: p.task_id };
      }
      case "complete_task": {
        const p = payload as CompleteTaskPayload;
        await completeTask.mutateAsync({ taskId: p.task_id, completed: true });
        return { appliedTargetId: p.task_id };
      }
      case "create_event": {
        const p = payload as CreateEventPayload;
        const created = await createEvent.mutateAsync({
          title: p.title,
          starts_at: p.starts_at,
          ends_at: p.ends_at,
          description: p.description ?? null,
          location: p.location ?? null,
          source_thought_id: p.source_thought_id ?? null,
          source_recording_id: p.source_recording_id ?? null,
        });
        return { appliedTargetId: created?.id };
      }
      case "reorder_day": {
        const p = payload as ReorderDayPayload;
        // Run sequentially — small N, and we want a per-task error to fail
        // the proposal as a whole rather than partially.
        for (const move of p.moves) {
          await updateTask.mutateAsync({
            taskId: move.task_id,
            patch: { scheduled_at: move.new_scheduled_at },
          });
        }
        return {};
      }
      case "split_task": {
        const p = payload as SplitTaskPayload;
        // Create N children of the source task.
        for (const part of p.parts) {
          await createTask.mutateAsync({
            title: part.title,
            parent_task_id: p.source_task_id,
            duration_minutes: part.duration_minutes ?? null,
          });
        }
        if (p.archive_source) {
          await completeTask.mutateAsync({
            taskId: p.source_task_id,
            completed: true,
          });
        }
        return { appliedTargetId: p.source_task_id };
      }
    }
  }

  async function handleApprove(payload: Proposal["payload"], wasEdited: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { appliedTargetId } = await executeProposal(payload);
      await recordDecision.mutateAsync({
        brief,
        proposalId: proposal.id,
        decision: {
          state: wasEdited ? "edited" : "approved",
          applied_at: new Date().toISOString(),
          applied_target_id: appliedTargetId,
          ...(wasEdited ? { edited_payload: payload } : {}),
        },
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    try {
      await recordDecision.mutateAsync({
        brief,
        proposalId: proposal.id,
        decision: { state: "dismissed" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (isApproved) {
    return (
      <DecisionRow
        proposal={proposal}
        decision={decision!}
        meta={meta}
        tone="approved"
      />
    );
  }
  if (isDismissed) {
    return (
      <DecisionRow
        proposal={proposal}
        decision={decision!}
        meta={meta}
        tone="dismissed"
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        meta.tone,
        busy && "opacity-60 pointer-events-none"
      )}
    >
      <header className="flex items-center gap-1.5 mb-1.5">
        <meta.icon className="w-3.5 h-3.5 text-ink-700" />
        <span className="text-[11px] font-semibold text-ink-900">{meta.label}</span>
      </header>
      <div className="text-xs text-ink-700 leading-relaxed mb-1.5">
        <ProposalSummary
          proposal={proposal}
          payload={isEditing ? editedPayload : proposal.payload}
        />
      </div>
      <p className="text-[11px] text-ink-500 italic mb-2">{proposal.reason}</p>

      {isEditing && (
        <ProposalEditor
          proposal={proposal}
          payload={editedPayload}
          onChange={setEditedPayload}
        />
      )}

      {error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-1.5 mb-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {!isEditing && (
          <>
            <ActionButton
              icon={CheckCircle2}
              tone="success"
              busy={busy}
              onClick={() => handleApprove(proposal.payload, false)}
            >
              אישור
            </ActionButton>
            <ActionButton
              icon={Pencil}
              tone="neutral"
              busy={busy}
              onClick={() => setIsEditing(true)}
            >
              ערוך לפני
            </ActionButton>
            <ActionButton
              icon={XCircle}
              tone="danger"
              busy={busy}
              onClick={handleDismiss}
            >
              דחייה
            </ActionButton>
          </>
        )}
        {isEditing && (
          <>
            <ActionButton
              icon={CheckCircle2}
              tone="success"
              busy={busy}
              onClick={() => handleApprove(editedPayload, true)}
            >
              שמור והפעל
            </ActionButton>
            <ActionButton
              icon={XCircle}
              tone="neutral"
              busy={busy}
              onClick={() => {
                setIsEditing(false);
                setEditedPayload(proposal.payload);
              }}
            >
              ביטול עריכה
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tiny presentational helpers

function ActionButton({
  icon: Icon,
  tone,
  onClick,
  busy,
  children,
}: {
  icon: typeof CheckCircle2;
  tone: "success" | "danger" | "neutral";
  onClick: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const cls = {
    success:
      "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
    danger:
      "bg-white hover:bg-rose-50 text-rose-700 border-rose-300",
    neutral:
      "bg-white hover:bg-ink-50 text-ink-700 border-ink-300",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
        cls,
        busy && "opacity-60 cursor-wait"
      )}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {children}
    </button>
  );
}

function DecisionRow({
  proposal,
  decision,
  meta,
  tone,
}: {
  proposal: Proposal;
  decision: ProposalDecision;
  meta: (typeof KIND_META)[ProposalKind];
  tone: "approved" | "dismissed";
}) {
  const cls =
    tone === "approved"
      ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
      : "border-ink-200 bg-ink-50/40 text-ink-500";
  const Icon = tone === "approved" ? CheckCircle2 : XCircle;
  return (
    <div
      className={cn(
        "rounded-lg border p-2 flex items-center gap-2 text-xs",
        cls
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div className="flex-1 min-w-0 truncate">
        <span className="font-semibold">{meta.label}:</span>{" "}
        <ProposalSummary proposal={proposal} payload={
          decision.edited_payload ?? proposal.payload
        } />
      </div>
      {tone === "approved" && decision.applied_at && (
        <span className="text-[10px] tabular-nums shrink-0 opacity-70">
          {new Date(decision.applied_at).toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Per-kind summary text + editor.

function ProposalSummary({
  proposal,
  payload,
}: {
  proposal: Proposal;
  payload: Proposal["payload"];
}) {
  switch (proposal.kind) {
    case "move_task": {
      const p = payload as MoveTaskPayload;
      const taskName = p.task_title ?? `task:${p.task_id.slice(0, 6)}`;
      if (!p.current_scheduled_at) {
        return (
          <span>
            להעביר את <b>{taskName}</b> ל־<b>{fmtDateTime(p.new_scheduled_at)}</b>
          </span>
        );
      }
      return (
        <span className="block">
          <span className="block">
            להעביר את <b>{taskName}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 mt-1 text-[11px]">
            <span className="line-through text-ink-400">
              {fmtDateTime(p.current_scheduled_at)}
            </span>
            <ArrowLeft className="w-3 h-3 text-ink-400" />
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {fmtDateTime(p.new_scheduled_at)}
            </span>
          </span>
        </span>
      );
    }
    case "schedule_task": {
      const p = payload as ScheduleTaskPayload;
      const taskName = p.task_title ?? `task:${p.task_id.slice(0, 6)}`;
      return (
        <span className="block">
          <span className="block">
            לתזמן את <b>{taskName}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 mt-1 text-[11px]">
            <span className="font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
              {fmtDateTime(p.new_scheduled_at)}
            </span>
            {p.duration_minutes ? (
              <span className="text-ink-500">למשך {p.duration_minutes} דק׳</span>
            ) : null}
          </span>
        </span>
      );
    }
    case "create_event": {
      const p = payload as CreateEventPayload;
      return (
        <span>
          ליצור אירוע <b>"{p.title}"</b> ב־<b>{fmtDateTime(p.starts_at)}</b>
          {p.location ? ` ב־${p.location}` : ""}
        </span>
      );
    }
    case "reorder_day": {
      const p = payload as ReorderDayPayload;
      return (
        <span>לסדר מחדש {p.moves.length} משימות במהלך היום</span>
      );
    }
    case "complete_task": {
      const p = payload as CompleteTaskPayload;
      return (
        <span>
          לסמן את <b>{p.task_title ?? `task:${p.task_id.slice(0, 6)}`}</b> כבוצע
        </span>
      );
    }
    case "split_task": {
      const p = payload as SplitTaskPayload;
      return (
        <span>
          לפצל את <b>{p.source_task_title ?? `task:${p.source_task_id.slice(0, 6)}`}</b>
          {" "}ל־{p.parts.length} משימות
        </span>
      );
    }
    default:
      return <span className="text-ink-400">פעולה לא מוכרת</span>;
  }
}

function ProposalEditor({
  proposal,
  payload,
  onChange,
}: {
  proposal: Proposal;
  payload: Proposal["payload"];
  onChange: (p: Proposal["payload"]) => void;
}) {
  // For now we only support time/string edits inline. Reorder + split open the
  // proposal as-is — editing those is post-MVP.
  switch (proposal.kind) {
    case "move_task":
    case "schedule_task": {
      const p = payload as MoveTaskPayload | ScheduleTaskPayload;
      return (
        <div className="bg-white border border-ink-200 rounded-md p-2 mb-2 space-y-2">
          <Field label="זמן חדש">
            <DateTimeField
              value={toLocalInput(p.new_scheduled_at)}
              onChange={(v) =>
                onChange({ ...p, new_scheduled_at: fromLocalInput(v) })
              }
              className="w-full"
            />
          </Field>
          {"duration_minutes" in p && (
            <Field label="משך (דקות)">
              <input
                type="number"
                value={p.duration_minutes ?? ""}
                onChange={(e) =>
                  onChange({
                    ...p,
                    duration_minutes: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  } as ScheduleTaskPayload)
                }
                className="text-xs border border-ink-200 rounded px-2 py-1 w-full"
              />
            </Field>
          )}
        </div>
      );
    }
    case "create_event": {
      const p = payload as CreateEventPayload;
      return (
        <div className="bg-white border border-ink-200 rounded-md p-2 mb-2 space-y-2">
          <Field label="כותרת">
            <input
              type="text"
              value={p.title}
              onChange={(e) => onChange({ ...p, title: e.target.value })}
              className="text-xs border border-ink-200 rounded px-2 py-1 w-full"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="התחלה">
              <DateTimeField
                value={toLocalInput(p.starts_at)}
                onChange={(v) =>
                  onChange({ ...p, starts_at: fromLocalInput(v) })
                }
                className="w-full"
              />
            </Field>
            <Field label="סיום">
              <DateTimeField
                value={toLocalInput(p.ends_at)}
                onChange={(v) =>
                  onChange({ ...p, ends_at: fromLocalInput(v) })
                }
                className="w-full"
              />
            </Field>
          </div>
          <Field label="מיקום">
            <input
              type="text"
              value={p.location ?? ""}
              onChange={(e) => onChange({ ...p, location: e.target.value })}
              className="text-xs border border-ink-200 rounded px-2 py-1 w-full"
            />
          </Field>
        </div>
      );
    }
    default:
      return (
        <div className="text-[11px] text-ink-500 italic mb-2">
          עריכה לא נתמכת לסוג ההצעה הזה — אפשר רק לאשר או לדחות.
        </div>
      );
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] text-ink-500 mb-0.5">{label}</div>
      {children}
    </label>
  );
}

// -----------------------------------------------------------------------------
// datetime-local helpers (Hebrew app, local TZ assumed).

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOff = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOff).toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

