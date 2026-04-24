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
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Thought } from "@/lib/types/domain";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useCreateProject } from "@/lib/hooks/useProjects";
import {
  useAssignThoughtToList,
  useRecordThoughtProcessing,
  useThoughtLists,
} from "@/lib/hooks";
import { useCreateEvent } from "@/lib/hooks/useEvents";
import { mockProvider, type DynamicSuggestion } from "@/lib/ai/thought-suggestions";
import { ListIcon } from "@/components/tasks/list-icons";
import { SendMessagePopover } from "./SendMessagePopover";

type FixedId =
  | "task"
  | "event"
  | "project"
  | "transcribe"
  | "summarize"
  | "assign"
  | "message";

interface AppliedRecord {
  /** Suggestion id (fixed ids are the strings above; dynamic ids come from the provider). */
  suggestionId: string;
  targetType: "task" | "event" | "project" | "recording" | "message";
  targetId: string;
  /** Short human label for the "פתח" link ("ראה את המשימה שנוצרה"). */
  targetLabel: string;
}

interface ThoughtAiBannerProps {
  thought: Thought;
  /** Called when the user explicitly closes the banner. */
  onClose: (action: "mark_processed" | "archive" | "leave") => void;
  onOpenTask?: (taskId: string) => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenProject?: (projectId: string) => void;
}

/**
 * The inline accordion shown inside a thought card when the user clicks
 * "⚡ עבד". Hosts both fixed actions (always shown) and dynamic ones
 * surfaced by the AI adapter. Applying an action does NOT remove the other
 * actions — it just marks the applied one with a ✓ and an "פתח" link to
 * the created entity (SPEC §19 "שרשור הצעות").
 */
export function ThoughtAiBanner({
  thought,
  onClose,
  onOpenTask,
  onOpenEvent,
  onOpenProject,
}: ThoughtAiBannerProps) {
  const [dynamic, setDynamic] = useState<DynamicSuggestion[]>([]);
  const [applied, setApplied] = useState<Record<string, AppliedRecord>>({});
  const [showSend, setShowSend] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showCloseMenu, setShowCloseMenu] = useState(false);

  const { data: thoughtLists = [] } = useThoughtLists();
  const createTask = useCreateTask();
  const createEvent = useCreateEvent();
  const createProject = useCreateProject();
  const assignThoughtToList = useAssignThoughtToList();
  const recordProcessing = useRecordThoughtProcessing();

  // Fetch dynamic suggestions once per thought.
  useEffect(() => {
    let cancel = false;
    mockProvider.getSuggestions(thought).then((s) => {
      if (!cancel) setDynamic(s);
    });
    return () => {
      cancel = true;
    };
  }, [thought.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const record = (
    suggestionId: string,
    targetType: AppliedRecord["targetType"],
    targetId: string,
    targetLabel: string,
    aiSuggested = true
  ) => {
    setApplied((prev) => ({
      ...prev,
      [suggestionId]: { suggestionId, targetType, targetId, targetLabel },
    }));
    recordProcessing.mutate({
      thought_id: thought.id,
      target_type: targetType,
      target_id: targetId,
      ai_suggested: aiSuggested,
    });
  };

  const aiTitle =
    thought.ai_generated_title ??
    (thought.text_content ?? "מחשבה").split(/\r?\n/)[0].slice(0, 60);

  const handleCreateTask = async () => {
    if (applied["task"]) return onOpenTask?.(applied["task"].targetId);
    const task = await createTask.mutateAsync({
      title: aiTitle,
      description: thought.text_content ?? null,
      task_list_id: null,
      parent_task_id: null,
      urgency: 3,
      status: "todo",
      source_thought_id: thought.id,
    });
    record("task", "task", task.id, task.title);
    onOpenTask?.(task.id);
  };

  const handleCreateEvent = async () => {
    if (applied["event"]) return onOpenEvent?.(applied["event"].targetId);
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60_000);
    const event = await createEvent.mutateAsync({
      title: aiTitle,
      description: thought.text_content ?? null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      source_thought_id: thought.id,
    });
    record("event", "event", event.id, event.title);
    onOpenEvent?.(event.id);
  };

  const handleCreateProject = async () => {
    if (applied["project"]) return onOpenProject?.(applied["project"].targetId);
    // `projects` table doesn't yet have `source_thought_id` (deferred to a
    // future phase); the provenance is still captured in `thought_processings`.
    const project = await createProject.mutateAsync({
      name: aiTitle,
      description: thought.text_content ?? null,
    });
    record("project", "project", project.id, project.name);
    onOpenProject?.(project.id);
  };

  const handleAssign = async (listId: string, listName: string) => {
    await assignThoughtToList.mutateAsync({ thoughtId: thought.id, listId });
    // Assignment is not a "creation" in the processings sense — we still log
    // it so the trail on the thought is complete.
    record(`assign:${listId}`, "task", listId, `רשימה: ${listName}`, false);
    setShowAssign(false);
  };

  const handleSent = (channel: "whatsapp" | "email") => {
    // We don't have a concrete entity id — use the thought.id as a placeholder
    // for the trail; target_type='message' tells the audit what it is.
    record(
      `message:${channel}`,
      "message",
      thought.id,
      channel === "whatsapp" ? "WhatsApp" : "מייל"
    );
    setShowSend(false);
  };

  const hasAudio = !!thought.recording_id;

  return (
    <div className="border border-ink-200 rounded-xl bg-ink-50/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700">
          <Zap className="w-3.5 h-3.5 text-accent-500" />
          עיבוד AI
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

      {/* Fixed suggestions */}
      <div className="flex flex-wrap gap-1.5">
        <FixedChip
          id="task"
          icon={<CheckSquare className="w-3.5 h-3.5" />}
          label="→ משימה"
          applied={applied["task"]}
          onApply={handleCreateTask}
          onOpen={() =>
            applied["task"] && onOpenTask?.(applied["task"].targetId)
          }
        />
        <FixedChip
          id="event"
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="→ אירוע"
          applied={applied["event"]}
          onApply={handleCreateEvent}
          onOpen={() =>
            applied["event"] && onOpenEvent?.(applied["event"].targetId)
          }
        />
        <FixedChip
          id="project"
          icon={<FolderKanban className="w-3.5 h-3.5" />}
          label="→ פרויקט"
          applied={applied["project"]}
          onApply={handleCreateProject}
          onOpen={() =>
            applied["project"] && onOpenProject?.(applied["project"].targetId)
          }
        />
        <FixedChip
          id="transcribe"
          icon={<Mic className="w-3.5 h-3.5" />}
          label="תמלל"
          applied={applied["transcribe"]}
          disabled={!hasAudio}
          tooltip={hasAudio ? undefined : "זמין רק למחשבות אודיו"}
          onApply={() => {
            /* Transcription wiring lives in the recordings phase. */
            record("transcribe", "recording", thought.recording_id!, "תמלול");
          }}
          onOpen={() => {
            /* No modal yet — dashboard link eventually. */
          }}
        />
        <FixedChip
          id="summarize"
          icon={<FileText className="w-3.5 h-3.5" />}
          label="סכם"
          applied={applied["summarize"]}
          onApply={() => {
            /* Summarization also rides on the real AI adapter. Mock: record it. */
            record("summarize", "task", thought.id, "סיכום");
          }}
          onOpen={() => {}}
        />
        <FixedChip
          id="assign"
          icon={<Tag className="w-3.5 h-3.5" />}
          label="שייך"
          onApply={() => setShowAssign((v) => !v)}
          applied={undefined}
          onOpen={() => {}}
        />
        <FixedChip
          id="message"
          icon={<MessageCircle className="w-3.5 h-3.5" />}
          label="שלח הודעה"
          applied={applied["message:whatsapp"] ?? applied["message:email"]}
          onApply={() => setShowSend((v) => !v)}
          onOpen={() => setShowSend(true)}
        />
      </div>

      {/* Assign popover (inline) */}
      {showAssign && (
        <div className="border border-ink-200 rounded-lg bg-white p-2 max-h-40 overflow-y-auto">
          <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 pb-1">
            בחר רשימה לשיוך
          </div>
          {thoughtLists.length === 0 ? (
            <p className="text-xs text-ink-500 px-2 py-2">
              עוד אין רשימות מחשבות.
            </p>
          ) : (
            thoughtLists.map((l) => (
              <button
                key={l.id}
                onClick={() => handleAssign(l.id, l.name)}
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

      {/* Send-message popover */}
      {showSend && (
        <SendMessagePopover
          suggestedBody={thought.text_content ?? ""}
          onClose={() => setShowSend(false)}
          onSent={handleSent}
        />
      )}

      {/* Dynamic suggestions */}
      {dynamic.length > 0 && (
        <div className="space-y-1.5 border-t border-ink-200 pt-2">
          <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            הצעות מה-AI
          </div>
          {dynamic.map((s) => {
            const aId = applied[s.id];
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 text-xs text-ink-700"
              >
                {aId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-success-500 shrink-0" />
                    <span className="line-through text-ink-500 flex-1">
                      {s.label}
                    </span>
                    <span className="text-primary-600">בוצע</span>
                  </>
                ) : (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border border-ink-300 shrink-0" />
                    <span className="flex-1">{s.label}</span>
                    <button
                      onClick={() => handleDynamic(s)}
                      className="text-primary-600 hover:underline"
                      type="button"
                    >
                      החל
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Handler for dynamic suggestions: each `kind` has a sensible default
  // action, delegating to the same handlers as the fixed suggestions.
  function handleDynamic(s: DynamicSuggestion) {
    switch (s.kind) {
      case "create_event":
        return handleCreateEvent();
      case "split_tasks":
      case "link_project":
      case "assign_list":
      case "create_contact":
      default:
        // For now: record that the user engaged with the suggestion even if
        // the downstream flow is another phase. Keeps the audit trail
        // truthful.
        return record(s.id, "task", thought.id, s.label, true);
    }
  }
}

// Fixed chip --------------------------------------------------------------

interface FixedChipProps {
  id: FixedId;
  icon: React.ReactNode;
  label: string;
  applied?: AppliedRecord;
  onApply: () => void;
  onOpen: () => void;
  disabled?: boolean;
  tooltip?: string;
}

function FixedChip({
  icon,
  label,
  applied,
  onApply,
  onOpen,
  disabled,
  tooltip,
}: FixedChipProps) {
  if (applied) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full border border-success-500 bg-success-500/10 text-success-700 text-[11px] font-medium px-2 py-1"
        title={applied.targetLabel}
      >
        <Check className="w-3 h-3" />
        {label}
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-0.5 ms-1 text-primary-600 hover:underline"
          type="button"
        >
          <ExternalLink className="w-3 h-3" />
          פתח
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onApply}
      disabled={disabled}
      title={tooltip ?? label}
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border text-[11px] font-medium px-2 py-1 transition-colors",
        disabled
          ? "border-ink-200 text-ink-300 cursor-not-allowed"
          : "border-ink-300 bg-white text-ink-700 hover:bg-ink-100"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

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
