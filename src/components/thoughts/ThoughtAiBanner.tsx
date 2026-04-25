import { useEffect, useState } from "react";
import {
  Zap,
  CheckSquare,
  Calendar,
  FolderKanban,
  Mic,
  FileText,
  Tag,
  MessageCircle,
  Check,
  ExternalLink,
  X,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Thought } from "@/lib/types/domain";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useCreateProject } from "@/lib/hooks/useProjects";
import {
  useAssignThoughtToList,
  useRecordThoughtProcessing,
  useThoughtLists,
  useTaskLists,
} from "@/lib/hooks";
import { useCreateEvent } from "@/lib/hooks/useEvents";
import {
  mockProvider,
  type AiPlan,
  type SuggestedAction,
} from "@/lib/ai/thought-suggestions";
import { ListIcon } from "@/components/tasks/list-icons";
import { SendMessagePopover } from "./SendMessagePopover";

interface AppliedRecord {
  targetType: "task" | "event" | "project" | "recording" | "message";
  targetId: string;
  targetLabel: string;
}

interface ThoughtAiBannerProps {
  thought: Thought;
  onClose: (action: "mark_processed" | "archive" | "leave") => void;
  onOpenTask?: (taskId: string) => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenProject?: (projectId: string) => void;
}

/**
 * AI banner — accordion in a thought card. Loads a structured plan from
 * the AI provider (mock for now, real Claude later) with pre-filled
 * payloads. The user reviews each suggestion's details and approves; we
 * never silently create entities. After approval, the chip stays visible
 * with a ✓ and an "פתח" link to the new entity (SPEC §19 שרשור הצעות).
 */
export function ThoughtAiBanner({
  thought,
  onClose,
  onOpenTask,
  onOpenEvent,
  onOpenProject,
}: ThoughtAiBannerProps) {
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [applied, setApplied] = useState<Record<number, AppliedRecord>>({});
  const [showSend, setShowSend] = useState<number | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showCloseMenu, setShowCloseMenu] = useState(false);

  const { data: thoughtLists = [] } = useThoughtLists();
  const { data: taskLists = [] } = useTaskLists();
  const createTask = useCreateTask();
  const createEvent = useCreateEvent();
  const createProject = useCreateProject();
  const assignThoughtToList = useAssignThoughtToList();
  const recordProcessing = useRecordThoughtProcessing();

  // Build the AI plan once per thought + once task lists are loaded
  // (matching against list names depends on them).
  useEffect(() => {
    let cancel = false;
    setPlanLoading(true);
    mockProvider
      .buildPlan(thought, { taskLists, thoughtLists })
      .then((p) => {
        if (!cancel) {
          setPlan(p);
          setPlanLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought.id, taskLists.length, thoughtLists.length]);

  const record = (
    actionIndex: number,
    targetType: AppliedRecord["targetType"],
    targetId: string,
    targetLabel: string,
    aiSuggested = true
  ) => {
    setApplied((prev) => ({
      ...prev,
      [actionIndex]: { targetType, targetId, targetLabel },
    }));
    recordProcessing.mutate({
      thought_id: thought.id,
      target_type: targetType,
      target_id: targetId,
      ai_suggested: aiSuggested,
    });
  };

  const apply = async (actionIndex: number, action: SuggestedAction) => {
    if (applied[actionIndex]) return;

    if (action.kind === "create_task") {
      const t = await createTask.mutateAsync({
        title: action.payload.title,
        description: action.payload.description ?? null,
        task_list_id: action.payload.task_list_id ?? null,
        parent_task_id: null,
        urgency: action.payload.urgency ?? 3,
        status: "todo",
        scheduled_at: action.payload.due_at ?? null,
        source_thought_id: thought.id,
      });
      record(actionIndex, "task", t.id, t.title);
      onOpenTask?.(t.id);
      return;
    }

    if (action.kind === "create_event") {
      const e = await createEvent.mutateAsync({
        title: action.payload.title,
        description: action.payload.description ?? null,
        starts_at: action.payload.starts_at,
        ends_at: action.payload.ends_at,
        all_day: action.payload.all_day,
        source_thought_id: thought.id,
      });
      record(actionIndex, "event", e.id, e.title);
      onOpenEvent?.(e.id);
      return;
    }

    if (action.kind === "create_project") {
      const p = await createProject.mutateAsync({
        name: action.payload.name,
        description: action.payload.description ?? null,
      });
      record(actionIndex, "project", p.id, p.name);
      onOpenProject?.(p.id);
      return;
    }

    if (action.kind === "assign_list") {
      await assignThoughtToList.mutateAsync({
        thoughtId: thought.id,
        listId: action.payload.list_id,
      });
      record(
        actionIndex,
        "task",
        action.payload.list_id,
        `רשימה: ${action.payload.list_name}`,
        false
      );
      return;
    }

    if (action.kind === "send_message") {
      setShowSend(actionIndex);
      return;
    }
  };

  const handleSent = (actionIndex: number, channel: "whatsapp" | "email") => {
    record(
      actionIndex,
      "message",
      thought.id,
      channel === "whatsapp" ? "WhatsApp" : "מייל"
    );
    setShowSend(null);
  };

  const handleAssignToThoughtList = async (listId: string, listName: string) => {
    await assignThoughtToList.mutateAsync({ thoughtId: thought.id, listId });
    setShowAssign(false);
    // Use a synthetic index that won't collide with `plan.actions` indices.
    const syntheticIdx = -1 - Object.keys(applied).length;
    record(syntheticIdx, "task", listId, `רשימת מחשבות: ${listName}`, false);
  };

  return (
    <div className="border border-ink-200 rounded-xl bg-ink-50/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700">
          <Zap className="w-3.5 h-3.5 text-accent-500" />
          עיבוד AI
          {planLoading && (
            <Loader2 className="w-3 h-3 animate-spin text-ink-500" />
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCloseMenu((v) => !v)}
            className="p-1 rounded hover:bg-ink-100"
            title="סגור"
            type="button"
          >
            <X className="w-3.5 h-3.5 text-ink-500" />
          </button>
          {showCloseMenu && (
            <div className="absolute end-0 top-full mt-1 z-30 bg-white border border-ink-200 rounded-lg shadow-lift w-56 py-1">
              <MenuItem
                onClick={() => {
                  setShowCloseMenu(false);
                  onClose("mark_processed");
                }}
              >
                סמן כמעובדת וסגור
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setShowCloseMenu(false);
                  onClose("archive");
                }}
              >
                העבר לארכיון וסגור
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setShowCloseMenu(false);
                  onClose("leave");
                }}
              >
                השאר פתוחה
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {/* Plan summary line */}
      {plan && plan.actions.length === 0 && !planLoading && (
        <div className="text-xs text-ink-500 inline-flex items-center gap-1">
          <Info className="w-3 h-3" />
          לא זוהתה פעולה ספציפית בטקסט. תוכלי להפעיל פעולה ידנית למטה.
        </div>
      )}

      {/* AI-driven suggestions with previews */}
      {plan && (
        <div className="space-y-2">
          {plan.actions.map((action, idx) => {
            const a = applied[idx];
            return (
              <SuggestionRow
                key={idx}
                action={action}
                applied={a}
                onApply={() => apply(idx, action)}
                onOpen={() => {
                  if (!a) return;
                  if (a.targetType === "task") onOpenTask?.(a.targetId);
                  else if (a.targetType === "event") onOpenEvent?.(a.targetId);
                  else if (a.targetType === "project")
                    onOpenProject?.(a.targetId);
                }}
                showSendInline={showSend === idx}
                onSentInline={(ch) => handleSent(idx, ch)}
                onCloseSendInline={() => setShowSend(null)}
                thoughtText={thought.text_content ?? ""}
              />
            );
          })}
        </div>
      )}

      {/* Always-available manual fallbacks (assign-to-thought-list, summarize, transcribe) */}
      <div className="border-t border-ink-200 pt-2 space-y-2">
        <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          פעולות נוספות
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setShowAssign((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
            type="button"
          >
            <Tag className="w-3.5 h-3.5" />
            שייך לרשימת מחשבות
          </button>
          {thought.recording_id && (
            <button
              onClick={() =>
                record(-1000, "recording", thought.recording_id!, "תמלול")
              }
              className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
              type="button"
            >
              <Mic className="w-3.5 h-3.5" />
              תמלל
            </button>
          )}
          <button
            onClick={() => record(-2000, "task", thought.id, "סיכום")}
            className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
            type="button"
          >
            <FileText className="w-3.5 h-3.5" />
            סכם
          </button>
        </div>

        {showAssign && (
          <div className="border border-ink-200 rounded-lg bg-white p-2 max-h-40 overflow-y-auto">
            {thoughtLists.length === 0 ? (
              <p className="text-xs text-ink-500 px-2 py-2">
                עוד אין רשימות מחשבות.
              </p>
            ) : (
              thoughtLists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleAssignToThoughtList(l.id, l.name)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-start hover:bg-ink-50 rounded"
                  type="button"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: l.color ?? "#6b6b80" }}
                  />
                  {l.emoji && <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />}
                  <span>{l.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SuggestionRow — preview + apply for one AI action
// -----------------------------------------------------------------------------

function SuggestionRow({
  action,
  applied,
  onApply,
  onOpen,
  showSendInline,
  onSentInline,
  onCloseSendInline,
  thoughtText,
}: {
  action: SuggestedAction;
  applied?: AppliedRecord;
  onApply: () => void;
  onOpen: () => void;
  showSendInline: boolean;
  onSentInline: (ch: "whatsapp" | "email") => void;
  onCloseSendInline: () => void;
  thoughtText: string;
}) {
  const meta = ACTION_META[action.kind];
  const Icon = meta.icon;

  return (
    <div className="border border-ink-200 rounded-lg bg-white">
      <div className="flex items-start gap-2 p-2">
        <div className="mt-0.5">
          <Icon className={cn("w-4 h-4", meta.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-ink-900 mb-0.5">
            {meta.label}
          </div>
          <ActionPreview action={action} />
          <div className="text-[10px] text-ink-500 mt-1 italic">
            {action.reasoning}
          </div>
        </div>
        <div className="shrink-0">
          {applied ? (
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-success-700 bg-success-500/10 border border-success-500 rounded-full px-2 py-1"
              type="button"
            >
              <Check className="w-3 h-3" />
              <ExternalLink className="w-3 h-3" />
              פתח
            </button>
          ) : (
            <button
              onClick={onApply}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-full px-2.5 py-1"
              type="button"
            >
              צור
            </button>
          )}
        </div>
      </div>

      {showSendInline && action.kind === "send_message" && (
        <div className="px-2 pb-2">
          <SendMessagePopover
            suggestedRecipient={action.payload.recipient}
            suggestedBody={action.payload.body || thoughtText}
            onSent={onSentInline}
            onClose={onCloseSendInline}
          />
        </div>
      )}
    </div>
  );
}

function ActionPreview({ action }: { action: SuggestedAction }) {
  if (action.kind === "create_task") {
    const p = action.payload;
    return (
      <div className="text-xs text-ink-700 space-y-0.5">
        <div>
          <span className="text-ink-500">כותרת:</span>{" "}
          <span className="font-medium">{p.title}</span>
        </div>
        {p.task_list_name && (
          <div>
            <span className="text-ink-500">רשימה:</span> {p.task_list_name}
          </div>
        )}
        {p.due_at && (
          <div>
            <span className="text-ink-500">תאריך:</span>{" "}
            {new Date(p.due_at).toLocaleDateString("he-IL", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
        )}
      </div>
    );
  }

  if (action.kind === "create_event") {
    const p = action.payload;
    const start = new Date(p.starts_at);
    return (
      <div className="text-xs text-ink-700 space-y-0.5">
        <div>
          <span className="text-ink-500">כותרת:</span>{" "}
          <span className="font-medium">{p.title}</span>
        </div>
        <div>
          <span className="text-ink-500">תאריך:</span>{" "}
          {start.toLocaleDateString("he-IL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {!p.all_day && (
            <span className="ms-1">
              ב-
              {start.toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {p.all_day && <span className="ms-1 text-ink-500">(כל היום)</span>}
        </div>
      </div>
    );
  }

  if (action.kind === "create_project") {
    return (
      <div className="text-xs text-ink-700">
        <span className="text-ink-500">שם:</span>{" "}
        <span className="font-medium">{action.payload.name}</span>
      </div>
    );
  }

  if (action.kind === "assign_list") {
    return (
      <div className="text-xs text-ink-700">
        <span className="text-ink-500">לרשימה:</span>{" "}
        <span className="font-medium">{action.payload.list_name}</span>
      </div>
    );
  }

  if (action.kind === "send_message") {
    const p = action.payload;
    return (
      <div className="text-xs text-ink-700 space-y-0.5">
        {p.recipient && (
          <div>
            <span className="text-ink-500">נמען:</span> {p.recipient}
          </div>
        )}
        <div className="truncate">
          <span className="text-ink-500">תוכן:</span> {p.body}
        </div>
      </div>
    );
  }

  return null;
}

// -----------------------------------------------------------------------------

const ACTION_META: Record<
  SuggestedAction["kind"],
  { label: string; icon: typeof CheckSquare; iconColor: string }
> = {
  create_task: {
    label: "צור משימה",
    icon: CheckSquare,
    iconColor: "text-primary-600",
  },
  create_event: {
    label: "צור אירוע",
    icon: Calendar,
    iconColor: "text-accent-600",
  },
  create_project: {
    label: "צור פרויקט",
    icon: FolderKanban,
    iconColor: "text-primary-600",
  },
  assign_list: {
    label: "שייך לרשימה",
    icon: Tag,
    iconColor: "text-ink-700",
  },
  send_message: {
    label: "שלח הודעה",
    icon: MessageCircle,
    iconColor: "text-ink-700",
  },
};

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-start px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
      type="button"
    >
      {children}
    </button>
  );
}
