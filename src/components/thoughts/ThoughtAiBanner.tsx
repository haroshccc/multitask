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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Thought } from "@/lib/types/domain";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCreateProject, useProjects } from "@/lib/hooks/useProjects";
import {
  useAssignThoughtToList,
  useRecordThoughtProcessing,
  useThoughtLists,
  useCreateThoughtList,
  useTaskLists,
} from "@/lib/hooks";
import {
  mockProvider,
  type AiPlan,
  type SuggestedAction,
} from "@/lib/ai/thought-suggestions";
import { ListIcon } from "@/components/tasks/list-icons";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { EventEditModal } from "@/components/calendar/EventEditModal";
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
  /**
   * When true: hides the banner's own close-X (the host modal already has
   * its own close button) and skips the "what to do with the thought?"
   * decision menu. Used inside `ThoughtEditModal`'s "נוצרו מזה" tab.
   */
  embedded?: boolean;
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
  embedded,
}: ThoughtAiBannerProps) {
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [applied, setApplied] = useState<Record<number, AppliedRecord>>({});
  const [showSend, setShowSend] = useState<number | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showCloseMenu, setShowCloseMenu] = useState(false);
  // Collapsed state hides only the AI-suggestion list; the manual "פעולות
  // ידניות" buttons stay visible always so the user keeps a way to create
  // entities without scrolling through the AI proposals.
  const [aiCollapsed, setAiCollapsed] = useState(false);

  const { data: thoughtLists = [] } = useThoughtLists();
  const { data: taskLists = [] } = useTaskLists();
  const { data: projects = [] } = useProjects();
  // Pull a sample of recent tasks so the AI can learn from history (which
  // lists the user typically dumps similar tasks into).
  const { data: recentTasks = [] } = useTasks({});
  const createProject = useCreateProject();
  const createThoughtList = useCreateThoughtList();
  const assignThoughtToList = useAssignThoughtToList();
  const recordProcessing = useRecordThoughtProcessing();
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  // After picking a project, ask the user whether to also create a
  // dedicated thought-list for that project (per user-spec #2).
  const [pendingProject, setPendingProject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  /**
   * Per user feedback: pressing "צור" on an AI suggestion should NOT
   * immediately materialize the entity — only the user's explicit save
   * inside the create-mode modal does. This state holds the suggestion
   * being authored; the modal's `onCreated` callback flips the chip
   * to ✓ "פתח" only after a successful save. Discard creates nothing.
   */
  const [pendingCreate, setPendingCreate] = useState<{
    actionIndex: number;
    action: SuggestedAction;
  } | null>(null);

  // Build the AI plan once per thought + once task lists / recent tasks
  // load (history-aware list ranking depends on them).
  useEffect(() => {
    let cancel = false;
    setPlanLoading(true);
    mockProvider
      .buildPlan(thought, {
        taskLists,
        thoughtLists,
        recentTasks: recentTasks.slice(0, 80).map((t) => ({
          title: t.title,
          task_list_id: t.task_list_id,
          tags: t.tags ?? [],
        })),
      })
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
  }, [thought.id, taskLists.length, thoughtLists.length, recentTasks.length]);

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

    // For create_task / create_event we DEFER materialization until the
    // user explicitly saves the modal. This is the spec: "don't mark
    // applied if I clicked but didn't save."
    if (action.kind === "create_task" || action.kind === "create_event") {
      setPendingCreate({ actionIndex, action });
      return;
    }

    if (action.kind === "create_project") {
      // Projects have no edit modal yet — keep the immediate-create flow
      // and show the chip as applied right away. (TODO when ProjectEditModal
      // ships: same deferred-create pattern as tasks/events.)
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

  /**
   * Step 1 of the link-to-project flow: user picked a project, now choose
   * which thought-list to attach the thought to. Two options surface:
   *   (a) Create / reuse a thought-list named like the project (per-project).
   *   (b) Use the general "מחשבות על פרויקטים" auto-list (the catch-all).
   *
   * The provenance record (`thought_processings` target_type='project') is
   * written once, after the chosen list assignment completes. Until
   * `thought_lists` gain a `project_id` column (deferred migration), the
   * "per-project" list is just a freestanding list whose name matches the
   * project — searchable but not enforced as a hard link.
   */
  const handleProjectPicked = (projectId: string, projectName: string) => {
    setShowProjectPicker(false);
    setPendingProject({ id: projectId, name: projectName });
  };

  const completeProjectLink = async (mode: "per_project" | "general") => {
    if (!pendingProject) return;
    const { id: projectId, name: projectName } = pendingProject;
    let bucket: typeof thoughtLists[number] | undefined;

    if (mode === "per_project") {
      bucket = thoughtLists.find((l) => l.name === projectName);
      if (!bucket) {
        bucket = await createThoughtList.mutateAsync({
          name: projectName,
          emoji: "icon:projects",
          color: "#6366f1",
        });
      }
    } else {
      bucket = thoughtLists.find((l) => l.name === "מחשבות על פרויקטים");
      if (!bucket) {
        bucket = await createThoughtList.mutateAsync({
          name: "מחשבות על פרויקטים",
          emoji: "icon:projects",
          color: "#6366f1",
        });
      }
    }

    if (bucket) {
      await assignThoughtToList.mutateAsync({
        thoughtId: thought.id,
        listId: bucket.id,
      });
    }
    const syntheticIdx = -2000 - Object.keys(applied).length;
    record(
      syntheticIdx,
      "project",
      projectId,
      `פרויקט: ${projectName}`,
      false
    );
    setPendingProject(null);
    onOpenProject?.(projectId);
  };

  /**
   * Manual fallback creators (user-spec #2). Even when the AI returned
   * no actions, the user wants the option to spawn a task / event /
   * project from the thought directly. We construct a minimal payload
   * pre-filled from the thought text and reuse the same `apply()`
   * pipeline so the recording trail and "פתח" link work identically.
   */
  const manualCreate = async (kind: "task" | "event" | "project") => {
    const text = thought.text_content ?? "";
    const title = (
      thought.ai_generated_title ??
      text.split(/\r?\n/)[0] ??
      "מחשבה"
    ).slice(0, 60);
    const idx = -3000 - Object.keys(applied).length;

    if (kind === "task") {
      // Defer materialization until the user explicitly saves the modal —
      // same as AI-suggestion creates.
      setPendingCreate({
        actionIndex: idx,
        action: {
          kind: "create_task",
          payload: {
            title,
            description: text || undefined,
            task_list_id: null,
            urgency: 3,
            due_at: null,
          },
          reasoning: "יצירה ידנית",
          confidence: 1,
        },
      });
      return;
    }
    if (kind === "event") {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      const end = new Date(start.getTime() + 60 * 60_000);
      setPendingCreate({
        actionIndex: idx,
        action: {
          kind: "create_event",
          payload: {
            title,
            description: text || undefined,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            all_day: false,
          },
          reasoning: "יצירה ידנית",
          confidence: 1,
        },
      });
      return;
    }
    if (kind === "project") {
      // No project edit modal — keep the immediate-create flow.
      const p = await createProject.mutateAsync({
        name: title,
        description: text || null,
      });
      record(idx, "project", p.id, p.name, false);
      onOpenProject?.(p.id);
    }
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
          {!embedded && (
            <button
              onClick={() => {
                // If the user opened the banner and applied nothing, the
                // "what to do with the thought?" decision menu is friction —
                // just close. The menu only matters once at least one action
                // was applied (or the thought already had processings).
                const hasWork = Object.keys(applied).length > 0;
                if (!hasWork) {
                  onClose("leave");
                  return;
                }
                setShowCloseMenu((v) => !v);
              }}
              className="p-1 rounded hover:bg-ink-100"
              title="סגור"
              type="button"
            >
              <X className="w-3.5 h-3.5 text-ink-500" />
            </button>
          )}
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

      {/* Collapsible AI section. Only the AI proposals collapse — the
          manual fallbacks below this block are always visible so the
          user keeps a quick path to create-from-scratch. */}
      {plan && plan.actions.length > 0 && (
        <button
          onClick={() => setAiCollapsed((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-[11px] font-medium text-ink-600 hover:text-ink-900 px-1"
          type="button"
        >
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-accent-500" />
            הצעות AI ({plan.actions.length})
          </span>
          {aiCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {/* Plan summary line — even when AI returned no actions, surface the
          empty-state so the user understands why the proposals area is
          empty. Always shown (the collapse only affects non-empty plans). */}
      {plan && plan.actions.length === 0 && !planLoading && (
        <div className="text-xs text-ink-500 inline-flex items-center gap-1">
          <Info className="w-3 h-3" />
          לא זוהתה פעולה ספציפית בטקסט. תוכלי להפעיל פעולה ידנית למטה.
        </div>
      )}

      {!aiCollapsed && (
        <>
          {/* Bulk actions — when there are 2+ task suggestions, offer
              "צור הכל המשימות" so the user can accept the brainstorm in
              one click. */}
          {plan && (() => {
            const taskActionIdxs = plan.actions
              .map((a, i) => (a.kind === "create_task" ? i : -1))
              .filter((i) => i >= 0 && !applied[i]);
            if (taskActionIdxs.length < 2) return null;
            return (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-ink-500">
                  {taskActionIdxs.length} משימות מוצעות
                </span>
                <button
                  onClick={async () => {
                    for (const i of taskActionIdxs) {
                      await apply(i, plan.actions[i]);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-full px-2.5 py-1"
                  type="button"
                >
                  צור הכל
                </button>
              </div>
            );
          })()}

          {/* AI-driven suggestions with previews — scrollable when many. */}
          {plan && plan.actions.length > 0 && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pe-1">
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
        </>
      )}

      {/* Always-available manual fallbacks. Even when the AI proposed nothing,
          the user can still create entities directly from the thought. */}
      <div className="border-t border-ink-200 pt-2 space-y-2">
        <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          פעולות ידניות
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => manualCreate("task")}
            className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
            type="button"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            צור משימה
          </button>
          <button
            onClick={() => manualCreate("event")}
            className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
            type="button"
          >
            <Calendar className="w-3.5 h-3.5" />
            צור אירוע
          </button>
          <button
            onClick={() => manualCreate("project")}
            className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
            type="button"
          >
            <FolderKanban className="w-3.5 h-3.5" />
            צור פרויקט
          </button>
          <button
            onClick={() => setShowProjectPicker((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-ink-300 bg-white text-ink-700 text-[11px] font-medium px-2 py-1 hover:bg-ink-100"
            type="button"
          >
            <FolderKanban className="w-3.5 h-3.5" />
            שייך לפרויקט
          </button>
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

        {showProjectPicker && (
          <div className="border border-ink-200 rounded-lg bg-white p-2 max-h-48 overflow-y-auto">
            <div className="text-[10px] text-ink-500 px-1 pb-1">
              בחרי פרויקט לקישור.
            </div>
            {projects.length === 0 ? (
              <p className="text-xs text-ink-500 px-2 py-2">
                עוד אין פרויקטים. צרי אחד במסך הפרויקטים.
              </p>
            ) : (
              projects
                .filter((p) => !p.is_archived)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectPicked(p.id, p.name)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-start hover:bg-ink-50 rounded"
                    type="button"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-ink-500" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))
            )}
          </div>
        )}

        {pendingProject && (
          <div className="border border-ink-200 rounded-lg bg-white p-3 space-y-2">
            <div className="text-xs font-medium text-ink-900">
              אל איזו רשימת מחשבות לשייך?
            </div>
            <div className="text-[11px] text-ink-500">
              פרויקט: <span className="font-medium">{pendingProject.name}</span>
            </div>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                onClick={() => completeProjectLink("per_project")}
                className="text-start text-sm px-2 py-1.5 rounded-md border border-primary-300 bg-primary-50 hover:bg-primary-100"
                type="button"
              >
                <div className="font-medium text-primary-700">
                  צור רשימה ספציפית לפרויקט
                </div>
                <div className="text-[11px] text-primary-600/80">
                  רשימה חדשה בשם "{pendingProject.name}".
                </div>
              </button>
              <button
                onClick={() => completeProjectLink("general")}
                className="text-start text-sm px-2 py-1.5 rounded-md border border-ink-200 hover:bg-ink-50"
                type="button"
              >
                <div className="font-medium text-ink-900">
                  שייך לרשימה הכללית
                </div>
                <div className="text-[11px] text-ink-500">
                  "מחשבות על פרויקטים" — קולטת מחשבות מכל הפרויקטים.
                </div>
              </button>
              <button
                onClick={() => setPendingProject(null)}
                className="text-xs text-ink-500 hover:text-ink-700 px-2 py-1"
                type="button"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

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

      {/* Deferred create-mode modals. Only an explicit save inside these
          calls back to flip the suggestion chip to ✓ "פתח". Discard does
          not record a processing — the user's "I clicked but didn't save,
          don't mark anything" requirement. */}
      {pendingCreate && pendingCreate.action.kind === "create_task" && (
        <DeferredCreateTaskModal
          action={pendingCreate.action}
          thoughtId={thought.id}
          onCreated={(taskId, title) => {
            record(pendingCreate.actionIndex, "task", taskId, title);
            setPendingCreate(null);
            onOpenTask?.(taskId);
          }}
          onClose={() => setPendingCreate(null)}
        />
      )}
      {pendingCreate && pendingCreate.action.kind === "create_event" && (
        <DeferredCreateEventModal
          action={pendingCreate.action}
          thoughtId={thought.id}
          onCreated={(eventId, title) => {
            record(pendingCreate.actionIndex, "event", eventId, title);
            setPendingCreate(null);
            onOpenEvent?.(eventId);
          }}
          onClose={() => setPendingCreate(null)}
        />
      )}
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

// -----------------------------------------------------------------------------
// Deferred create-mode wrappers — render the entity modal in create mode
// with the AI's pre-filled payload. They route a successful save back to
// the banner so the suggestion chip flips to ✓ "פתח". Closing without
// saving leaves the chip un-applied (the spec).
// -----------------------------------------------------------------------------

function DeferredCreateTaskModal({
  action,
  thoughtId,
  onCreated,
  onClose,
}: {
  action: Extract<SuggestedAction, { kind: "create_task" }>;
  thoughtId: string;
  onCreated: (taskId: string, title: string) => void;
  onClose: () => void;
}) {
  const Modal = TaskEditModal;
  return (
    <Modal
      taskId={null}
      onClose={onClose}
      defaultTab="overview"
      createDraft={{
        title: action.payload.title,
        description: action.payload.description ?? null,
        task_list_id: action.payload.task_list_id ?? null,
        scheduled_at: action.payload.due_at ?? null,
        urgency: action.payload.urgency,
        tags: action.payload.tags,
        source_thought_id: thoughtId,
      }}
      onCreated={(id) => onCreated(id, action.payload.title)}
    />
  );
}

function DeferredCreateEventModal({
  action,
  thoughtId,
  onCreated,
  onClose,
}: {
  action: Extract<SuggestedAction, { kind: "create_event" }>;
  thoughtId: string;
  onCreated: (eventId: string, title: string) => void;
  onClose: () => void;
}) {
  const Modal = EventEditModal;
  return (
    <Modal
      open
      eventId={null}
      initialStart={new Date(action.payload.starts_at)}
      initialEnd={new Date(action.payload.ends_at)}
      initialTitle={action.payload.title}
      initialDescription={action.payload.description}
      initialAllDay={action.payload.all_day}
      initialSourceThoughtId={thoughtId}
      onCreated={(id) => onCreated(id, action.payload.title)}
      onClose={onClose}
    />
  );
}
