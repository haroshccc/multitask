import { useState } from "react";
import {
  Zap,
  Check,
  Tag,
  MoreHorizontal,
  RotateCcw,
  MessageCircle,
  Smartphone,
  Mic,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Thought, ThoughtList, ThoughtSource } from "@/lib/types/domain";
import { ListIcon } from "@/components/tasks/list-icons";
import {
  useMarkThoughtProcessed,
  useAssignThoughtToList,
  useUnassignThoughtFromList,
  useArchiveThought,
  useRestoreThought,
} from "@/lib/hooks";
import { ThoughtAiBanner } from "./ThoughtAiBanner";

interface ThoughtCardProps {
  thought: Thought;
  /** Lists this thought is currently assigned to. */
  assignedLists: ThoughtList[];
  /** All thought lists (for the "assign to list" popover). */
  allLists: ThoughtList[];
  /**
   * How many entities (tasks/events/projects/messages) have been spawned
   * from this thought already — drives the small "✓N" badge that signals
   * "you already did some processing here", which is independent of the
   * binary `processed_at` flag.
   */
  processedCount?: number;
  compact?: boolean;
  onOpen: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenProject?: (projectId: string) => void;
}

/**
 * Single thought card — the main unit of the thoughts feed.
 *
 * Structure top→bottom:
 *   - Chips of assigned lists (with "×" to unassign) + menu.
 *   - Source + timestamp.
 *   - AI-generated title (bold).
 *   - Text content, clamped to 3 lines.
 *   - Three actions: [📎 לרשימה] [⚡ עבד] [✓ סמן].
 *   - Optionally: AI banner inline below actions (accordion).
 */
export function ThoughtCard({
  thought,
  assignedLists,
  allLists,
  processedCount = 0,
  compact,
  onOpen,
  onOpenTask,
  onOpenEvent,
  onOpenProject,
}: ThoughtCardProps) {
  const [bannerOpen, setBannerOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const markProcessed = useMarkThoughtProcessed();
  const assignToList = useAssignThoughtToList();
  const unassignFromList = useUnassignThoughtFromList();
  const archive = useArchiveThought();
  const restore = useRestoreThought();

  const processed = !!thought.processed_at;
  const archived = thought.status === "archived";
  const hasAssignments = assignedLists.length > 0;
  const multiList = assignedLists.length >= 2;

  const cardAccent = hasAssignments
    ? assignedLists[0]?.color ?? "#6b6b80"
    : null;

  return (
    <div
      className={cn(
        "card overflow-visible",
        compact ? "px-3 py-2" : "px-3 py-3",
        !processed && "border-primary-200",
        multiList && "ring-1 ring-ink-200"
      )}
      style={
        cardAccent && hasAssignments && !multiList
          ? { borderInlineStartWidth: 3, borderInlineStartColor: cardAccent }
          : undefined
      }
      onClick={(e) => {
        // Open edit modal on background click (not on buttons / chip interactions).
        if (e.target === e.currentTarget) onOpen();
      }}
    >
      {/* Top row: chips + menu */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {assignedLists.map((l) => (
            <ListChip
              key={l.id}
              list={l}
              onRemove={() =>
                unassignFromList.mutate({ thoughtId: thought.id, listId: l.id })
              }
            />
          ))}
          {archived && (
            <span className="inline-flex items-center rounded-full bg-ink-100 text-ink-600 text-[10px] px-2 py-0.5">
              בארכיון
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMoreOpen((v) => !v);
            }}
            className="p-1 rounded hover:bg-ink-100"
            type="button"
          >
            <MoreHorizontal className="w-4 h-4 text-ink-500" />
          </button>
          {moreOpen && (
            <div className="absolute end-0 top-full mt-1 z-30 bg-white border border-ink-200 rounded-lg shadow-lift w-48 py-1">
              <RowMenuItem
                onClick={() => {
                  setMoreOpen(false);
                  onOpen();
                }}
              >
                פתח לעריכה
              </RowMenuItem>
              {!archived ? (
                <RowMenuItem
                  onClick={() => {
                    setMoreOpen(false);
                    archive.mutate(thought.id);
                  }}
                >
                  העבר לארכיון
                </RowMenuItem>
              ) : (
                <RowMenuItem
                  onClick={() => {
                    setMoreOpen(false);
                    restore.mutate(thought.id);
                  }}
                >
                  <RotateCcw className="w-3 h-3 inline me-1" />
                  שחזר מארכיון
                </RowMenuItem>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Source + timestamp + partial-processing badge */}
      <div className="flex items-center gap-2 text-[11px] text-ink-500 mb-1">
        <SourceBadge source={thought.source} />
        <span>{formatRelativeTime(thought.created_at)}</span>
        {processedCount > 0 && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-success-500/10 text-success-700 text-[10px] font-medium px-1.5 py-0.5 ms-auto"
            title={`נוצרו ${processedCount} ישויות מהמחשבה הזו`}
          >
            <Check className="w-2.5 h-2.5" />
            {processedCount}
          </span>
        )}
      </div>

      {/* Title + body */}
      <div onClick={onOpen} className="cursor-pointer">
        {thought.ai_generated_title && (
          <div className="font-semibold text-ink-900 text-sm leading-tight mb-1">
            {thought.ai_generated_title}
          </div>
        )}
        {thought.text_content && (
          <div
            className={cn(
              "text-sm text-ink-700 whitespace-pre-wrap",
              compact ? "line-clamp-2" : "line-clamp-3"
            )}
          >
            {thought.text_content}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 mt-2 pt-2 border-t border-ink-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            onClick={() => setAssignMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 hover:bg-ink-100 rounded px-2 py-1"
            type="button"
          >
            <Tag className="w-3.5 h-3.5" />
            לרשימה
          </button>
          {assignMenuOpen && (
            <div className="absolute start-0 top-full mt-1 z-30 bg-white border border-ink-200 rounded-lg shadow-lift w-56 max-h-56 overflow-y-auto py-1">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1">
                בחר רשימה
              </div>
              {allLists.length === 0 ? (
                <p className="text-xs text-ink-500 px-3 py-2">
                  עוד אין רשימות מחשבות.
                </p>
              ) : (
                allLists.map((l) => {
                  const alreadyAssigned = assignedLists.some((a) => a.id === l.id);
                  return (
                    <button
                      key={l.id}
                      disabled={alreadyAssigned}
                      onClick={() => {
                        assignToList.mutate({
                          thoughtId: thought.id,
                          listId: l.id,
                        });
                        setAssignMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                        alreadyAssigned && "text-ink-400 cursor-not-allowed"
                      )}
                      type="button"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: l.color ?? "#6b6b80" }}
                      />
                      {l.emoji && <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />}
                      <span className="flex-1 truncate">{l.name}</span>
                      {alreadyAssigned && <Check className="w-3 h-3" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setBannerOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-1",
            bannerOpen
              ? "bg-accent-500/10 text-accent-600"
              : "text-ink-700 hover:bg-ink-100"
          )}
          type="button"
        >
          <Zap className="w-3.5 h-3.5" />
          עבד
        </button>

        <button
          onClick={() =>
            markProcessed.mutate({
              thoughtId: thought.id,
              processed: !processed,
            })
          }
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-1 ms-auto",
            processed
              ? "bg-success-500/10 text-success-700"
              : "text-ink-700 hover:bg-ink-100"
          )}
          type="button"
        >
          <Check className="w-3.5 h-3.5" />
          {processed ? "מעובד" : "סמן"}
        </button>
      </div>

      {bannerOpen && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <ThoughtAiBanner
            thought={thought}
            onOpenTask={onOpenTask}
            onOpenEvent={onOpenEvent}
            onOpenProject={onOpenProject}
            onClose={(action) => {
              setBannerOpen(false);
              if (action === "mark_processed") {
                markProcessed.mutate({
                  thoughtId: thought.id,
                  processed: true,
                });
              } else if (action === "archive") {
                archive.mutate(thought.id);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

// -- helpers ---------------------------------------------------------------

function ListChip({
  list,
  onRemove,
}: {
  list: ThoughtList;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2 py-0.5 border"
      style={{
        borderColor: list.color ?? "#d4d4d8",
        backgroundColor: list.color ? hexToRgba(list.color, 0.08) : undefined,
        color: list.color ?? "#52525b",
      }}
      title={list.name}
    >
      {list.emoji && <ListIcon emoji={list.emoji} className="w-3 h-3" />}
      <span className="truncate max-w-[100px]">{list.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="hover:text-danger-600"
        type="button"
        title="הסר מהרשימה"
      >
        ×
      </button>
    </span>
  );
}

function SourceBadge({ source }: { source: ThoughtSource }) {
  const info = SOURCE_INFO[source];
  const Icon = info.icon;
  return (
    <span className="inline-flex items-center gap-1" title={info.label}>
      <Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{info.label}</span>
    </span>
  );
}

const SOURCE_INFO: Record<
  ThoughtSource,
  { label: string; icon: typeof MessageCircle }
> = {
  app_text: { label: "אפליקציה", icon: Smartphone },
  app_audio: { label: "הקלטה", icon: Mic },
  whatsapp_text: { label: "WhatsApp", icon: MessageCircle },
  whatsapp_audio: { label: "WhatsApp · הקלטה", icon: Mic },
  whatsapp_image: { label: "WhatsApp · תמונה", icon: ImageIcon },
};

function RowMenuItem({
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

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שע'`;
  const d = Math.round(h / 24);
  if (d < 7) return `לפני ${d} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "rgba(100,100,100,0.08)";
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

