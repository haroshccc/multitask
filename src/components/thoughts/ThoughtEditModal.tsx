import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Tag as TagIcon,
  Link2,
  Mic,
  MessageCircle,
  Smartphone,
  Image as ImageIcon,
  Info,
  CheckSquare,
  Calendar as CalendarIcon,
  FolderKanban,
  ExternalLink,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useNavigate } from "react-router-dom";
import {
  useThought,
  useUpdateThought,
  useThoughtProcessings,
  useThoughtLists,
  useThoughtAssignments,
  useAssignThoughtToList,
  useUnassignThoughtFromList,
} from "@/lib/hooks";
import type { ThoughtSource } from "@/lib/types/domain";
import { ListIcon } from "@/components/tasks/list-icons";
import { UnsavedChangesGuard } from "@/components/ui/UnsavedChangesGuard";

interface ThoughtEditModalProps {
  thoughtId: string | null;
  onClose: () => void;
  /** Handlers to re-route "open target" clicks into parent-managed modals. */
  onOpenTask?: (taskId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

type Tab = "overview" | "source" | "created";

export function ThoughtEditModal({
  thoughtId,
  onClose,
  onOpenTask,
  onOpenEvent,
}: ThoughtEditModalProps) {
  const navigate = useNavigate();
  const open = !!thoughtId;
  const { data: thought } = useThought(thoughtId);
  const { data: processings = [] } = useThoughtProcessings(thoughtId);
  const { data: allLists = [] } = useThoughtLists();
  const { data: assignments = [] } = useThoughtAssignments(thoughtId);
  const updateThought = useUpdateThought();
  const assignToList = useAssignThoughtToList();
  const unassignFromList = useUnassignThoughtFromList();

  const [tab, setTab] = useState<Tab>("overview");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [guardOpen, setGuardOpen] = useState(false);

  useEffect(() => {
    if (!thought) return;
    setTitle(thought.ai_generated_title ?? "");
    setText(thought.text_content ?? "");
    setTags(thought.tags ?? []);
  }, [thought?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dirty when any user-editable text/tags differ from the persisted row.
  // List assignments are committed eagerly (their own service calls) and
  // intentionally not part of the "dirty" form.
  const dirty = useMemo(() => {
    if (!thought) return false;
    const tagsEqual =
      tags.length === (thought.tags?.length ?? 0) &&
      tags.every((t, i) => t === thought.tags?.[i]);
    return (
      title !== (thought.ai_generated_title ?? "") ||
      text !== (thought.text_content ?? "") ||
      !tagsEqual
    );
  }, [thought, title, text, tags]);

  const saveDraft = async (): Promise<boolean> => {
    if (!thought || !dirty) return true;
    try {
      await updateThought.mutateAsync({
        thoughtId: thought.id,
        patch: {
          ai_generated_title: title || null,
          text_content: text || null,
          tags,
        },
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleClose = () => {
    if (dirty) {
      setGuardOpen(true);
      return;
    }
    onClose();
  };

  const handleSaveAndClose = async () => {
    const ok = await saveDraft();
    if (ok) {
      setGuardOpen(false);
      onClose();
    }
  };

  const handleDiscardAndClose = () => {
    setGuardOpen(false);
    onClose();
  };

  const assignedIds = new Set(assignments.map((a) => a.list_id));

  if (!thought && !open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="כותרת (נוצרת ע״י AI)"
                  className="text-lg font-semibold text-ink-900 bg-transparent border-0 outline-none flex-1 min-w-0"
                />
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
                type="button"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="border-b border-ink-200 px-3 flex items-center gap-1 text-sm">
              <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
                <Info className="w-4 h-4" />
                פרטים
              </TabBtn>
              <TabBtn active={tab === "source"} onClick={() => setTab("source")}>
                <Link2 className="w-4 h-4" />
                מקור
              </TabBtn>
              <TabBtn active={tab === "created"} onClick={() => setTab("created")}>
                <CheckSquare className="w-4 h-4" />
                נוצרו מזה ({processings.length})
              </TabBtn>
            </div>

            <div className="p-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {tab === "overview" && (
                <div className="space-y-4">
                  <label className="block">
                    <div className="eyebrow mb-1">תוכן</div>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="field min-h-[140px] resize-y text-sm"
                      placeholder="הטקסט של המחשבה"
                    />
                  </label>

                  <div>
                    <div className="eyebrow mb-1 flex items-center gap-1">
                      <TagIcon className="w-3 h-3" />
                      תגים
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full bg-ink-100 text-ink-700 text-[11px] px-2 py-0.5"
                        >
                          #{t}
                          <button
                            onClick={() => {
                              const next = tags.filter((x) => x !== t);
                              setTags(next);
                            }}
                            className="hover:text-danger-600"
                            type="button"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = tagDraft.trim();
                          if (!v || tags.includes(v)) return;
                          setTags([...tags, v]);
                          setTagDraft("");
                        }
                      }}
                      placeholder="הקלידי תג ולחצי Enter"
                      className="field text-sm"
                    />
                  </div>

                  <div>
                    <div className="eyebrow mb-1">שיוך לרשימות</div>
                    <div className="flex flex-wrap gap-1.5">
                      {allLists.map((l) => {
                        const assigned = assignedIds.has(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => {
                              if (assigned) {
                                unassignFromList.mutate({
                                  thoughtId: thought!.id,
                                  listId: l.id,
                                });
                              } else {
                                assignToList.mutate({
                                  thoughtId: thought!.id,
                                  listId: l.id,
                                });
                              }
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border text-xs font-medium px-2.5 py-1 transition-colors",
                              assigned
                                ? "border-primary-500 bg-primary-500/10 text-primary-700"
                                : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                            )}
                            type="button"
                          >
                            {l.emoji && <ListIcon emoji={l.emoji} className="w-3 h-3" />}
                            {l.name}
                          </button>
                        );
                      })}
                      {allLists.length === 0 && (
                        <p className="text-xs text-ink-500">
                          עוד אין רשימות מחשבות. צור אחת במסך הראשי.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "source" && thought && (
                <div className="space-y-3 text-sm">
                  <Row label="מקור">
                    <SourceLabel source={thought.source} />
                  </Row>
                  <Row label="נוצרה בתאריך">
                    {new Date(thought.created_at).toLocaleString("he-IL")}
                  </Row>
                  {thought.recording_id && (
                    <Row label="הקלטה">
                      <button
                        onClick={() => navigate("/app/recordings")}
                        className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                        type="button"
                      >
                        <Mic className="w-3 h-3" />
                        פתח הקלטה
                      </button>
                    </Row>
                  )}
                  {thought.whatsapp_message_id && (
                    <Row label="WhatsApp ID">
                      <code className="text-xs">{thought.whatsapp_message_id}</code>
                    </Row>
                  )}
                  <Row label="סטטוס עיבוד">
                    {thought.processed_at
                      ? `עובדה ${new Date(thought.processed_at).toLocaleString("he-IL")}`
                      : "לא מעובדת"}
                  </Row>
                </div>
              )}

              {tab === "created" && (
                <div className="space-y-2">
                  {processings.length === 0 ? (
                    <p className="text-sm text-ink-500">
                      עוד לא נוצרו ישויות מהמחשבה הזו.
                    </p>
                  ) : (
                    processings.map((p) => {
                      const icon = TARGET_ICON[p.target_type];
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (p.target_type === "task") onOpenTask?.(p.target_id);
                            else if (p.target_type === "event")
                              onOpenEvent?.(p.target_id);
                            else if (p.target_type === "project")
                              navigate(`/app/projects/${p.target_id}`);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start rounded-lg border border-ink-200 hover:bg-ink-50"
                          type="button"
                        >
                          {icon}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-ink-900">
                              {TARGET_LABEL[p.target_type]}
                            </div>
                            <div className="text-[11px] text-ink-500">
                              {new Date(p.created_at).toLocaleString("he-IL")}
                              {p.ai_suggested && " · AI"}
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-ink-400" />
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Footer: explicit save. Closing X / outside-click route through
                handleClose, which pops the unsaved-changes guard if dirty. */}
            <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-end gap-2">
              {dirty && (
                <span className="text-[11px] text-warning-600 me-auto">
                  יש שינויים לא שמורים
                </span>
              )}
              <button
                onClick={handleClose}
                className="btn-ghost text-sm"
                type="button"
              >
                סגור
              </button>
              <button
                onClick={async () => {
                  const ok = await saveDraft();
                  if (ok) onClose();
                }}
                disabled={!dirty || updateThought.isPending}
                className={cn(
                  "btn-primary text-sm",
                  (!dirty || updateThought.isPending) &&
                    "opacity-40 cursor-not-allowed"
                )}
                type="button"
              >
                <Save className="w-3.5 h-3.5" />
                {updateThought.isPending ? "שומר..." : "שמור"}
              </button>
            </div>
          </motion.div>

          <UnsavedChangesGuard
            open={guardOpen}
            saving={updateThought.isPending}
            onSaveAndClose={handleSaveAndClose}
            onDiscardAndClose={handleDiscardAndClose}
            onCancel={() => setGuardOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --------------------------------------------------------------------------

function TabBtn({
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
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-3 py-2 border-b-2 text-xs font-medium transition-colors",
        active
          ? "border-primary-500 text-ink-900"
          : "border-transparent text-ink-500 hover:text-ink-700"
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-center">
      <span className="text-ink-500 text-[11px] font-medium">{label}</span>
      <span className="text-ink-900">{children}</span>
    </div>
  );
}

function SourceLabel({ source }: { source: ThoughtSource }) {
  const info: Record<ThoughtSource, { label: string; icon: typeof Smartphone }> =
    {
      app_text: { label: "אפליקציה · טקסט", icon: Smartphone },
      app_audio: { label: "אפליקציה · הקלטה", icon: Mic },
      whatsapp_text: { label: "WhatsApp · טקסט", icon: MessageCircle },
      whatsapp_audio: { label: "WhatsApp · הקלטה", icon: Mic },
      whatsapp_image: { label: "WhatsApp · תמונה", icon: ImageIcon },
    };
  const Icon = info[source].icon;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="w-3.5 h-3.5" />
      {info[source].label}
    </span>
  );
}

const TARGET_ICON: Record<string, React.ReactNode> = {
  task: <CheckSquare className="w-4 h-4 text-primary-600" />,
  event: <CalendarIcon className="w-4 h-4 text-primary-600" />,
  project: <FolderKanban className="w-4 h-4 text-primary-600" />,
  recording: <Mic className="w-4 h-4 text-primary-600" />,
  message: <MessageCircle className="w-4 h-4 text-primary-600" />,
};

const TARGET_LABEL: Record<string, string> = {
  task: "משימה",
  event: "אירוע",
  project: "פרויקט",
  recording: "הקלטה",
  message: "הודעה",
};
