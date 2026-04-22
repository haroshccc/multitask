import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Inbox,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useCreateThought,
  useDeleteThought,
  useThoughts,
  useUpdateThoughtStatus,
} from "@/lib/queries/thoughts";
import { useConvertThoughtToTask } from "@/lib/queries/tasks";
import type { Thought, ThoughtSource, ThoughtStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type TabKey = "unprocessed" | "processed" | "archived";

const TABS: { key: TabKey; status: ThoughtStatus; label: string; icon: typeof Inbox }[] = [
  { key: "unprocessed", status: "unprocessed", label: "לא מעובד", icon: Inbox },
  { key: "processed", status: "processed", label: "עובד", icon: CheckSquare },
  { key: "archived", status: "archived", label: "ארכיון", icon: Archive },
];

export function Thoughts() {
  const { user, activeOrganizationId } = useAuth();
  const [tab, setTab] = useState<TabKey>("unprocessed");
  const activeStatus = useMemo(() => TABS.find((t) => t.key === tab)!.status, [tab]);

  const { data, isLoading } = useThoughts(activeOrganizationId, { status: activeStatus });
  const createThought = useCreateThought();
  const updateStatus = useUpdateThoughtStatus();
  const convertToTask = useConvertThoughtToTask();
  const deleteThought = useDeleteThought();

  const [draft, setDraft] = useState("");

  const canWrite = Boolean(user && activeOrganizationId);

  const handleCreate = async () => {
    const body = draft.trim();
    if (!body || !user || !activeOrganizationId) return;
    await createThought.mutateAsync({
      orgId: activeOrganizationId,
      ownerId: user.id,
      text: body,
      source: "app_text",
    });
    setDraft("");
  };

  return (
    <ScreenScaffold
      title="מחשבות"
      subtitle="זרקי רעיון עכשיו, תעבדי אחר כך — הפכי למשימה, אירוע או פרויקט"
    >
      {canWrite && (
        <div className="card p-3 mb-4 flex items-start gap-2">
          <textarea
            className="field min-h-[48px] resize-none flex-1"
            placeholder="מה עולה לך בראש? Enter כדי לשמור, Shift+Enter לשורה חדשה"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCreate();
              }
            }}
            disabled={createThought.isPending}
          />
          <button
            onClick={handleCreate}
            disabled={!draft.trim() || createThought.isPending}
            className="btn-accent shrink-0"
          >
            {createThought.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>שמרי</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-ink-100 rounded-2xl mb-4 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
              tab === t.key ? "bg-white shadow-soft text-ink-900" : "text-ink-600 hover:text-ink-900"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card p-8 flex items-center justify-center text-ink-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState status={activeStatus} />
      ) : (
        <ul className="space-y-2">
          {data.map((thought) => (
            <ThoughtCard
              key={thought.id}
              thought={thought}
              onProcess={() =>
                updateStatus.mutate({ id: thought.id, status: "processed" })
              }
              onArchive={() =>
                updateStatus.mutate({ id: thought.id, status: "archived" })
              }
              onRestore={() =>
                updateStatus.mutate({ id: thought.id, status: "unprocessed" })
              }
              onConvert={async () => {
                if (!user || !activeOrganizationId) return;
                const title =
                  thought.ai_generated_title?.trim() ||
                  firstLine(thought.text_content ?? "") ||
                  "משימה ללא כותרת";
                await convertToTask.mutateAsync({
                  orgId: activeOrganizationId,
                  ownerId: user.id,
                  thoughtId: thought.id,
                  title,
                });
              }}
              onDelete={() => {
                if (confirm("למחוק את המחשבה לצמיתות?")) {
                  deleteThought.mutate(thought.id);
                }
              }}
              converting={convertToTask.isPending}
            />
          ))}
        </ul>
      )}
    </ScreenScaffold>
  );
}

interface ThoughtCardProps {
  thought: Thought;
  onProcess: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onConvert: () => Promise<void>;
  onDelete: () => void;
  converting: boolean;
}

function ThoughtCard({
  thought,
  onProcess,
  onArchive,
  onRestore,
  onConvert,
  onDelete,
  converting,
}: ThoughtCardProps) {
  const created = new Date(thought.created_at);
  const isUnprocessed = thought.status === "unprocessed";
  const isArchived = thought.status === "archived";
  const text = thought.text_content ?? "(ללא תוכן)";

  return (
    <li className="card p-3 md:p-4">
      <div className="flex items-start gap-3">
        <SourceBadge source={thought.source} />
        <div className="flex-1 min-w-0">
          {thought.ai_generated_title && (
            <div className="text-sm font-semibold text-ink-900 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              {thought.ai_generated_title}
            </div>
          )}
          <p className="text-sm text-ink-800 whitespace-pre-wrap break-words leading-relaxed">
            {text}
          </p>
          {thought.ai_summary && (
            <p className="text-xs text-ink-500 mt-2">{thought.ai_summary}</p>
          )}
          <div className="text-xs text-ink-400 mt-2">
            {formatDistanceToNow(created, { addSuffix: true, locale: he })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-ink-200 flex-wrap">
        {isUnprocessed && (
          <>
            <button
              onClick={onConvert}
              disabled={converting}
              className="btn-ghost text-xs py-1.5 px-2.5"
              title="הפוך למשימה"
            >
              {converting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckSquare className="w-3.5 h-3.5" />
              )}
              הפוך למשימה
            </button>
            <button
              onClick={onProcess}
              className="btn-ghost text-xs py-1.5 px-2.5"
              title="סמן כעובד"
            >
              <Send className="w-3.5 h-3.5" />
              סמן כעובד
            </button>
          </>
        )}
        {thought.status === "processed" && (
          <button
            onClick={onRestore}
            className="btn-ghost text-xs py-1.5 px-2.5"
            title="החזר ללא-מעובד"
          >
            <Undo2 className="w-3.5 h-3.5" />
            החזר
          </button>
        )}
        {!isArchived && (
          <button
            onClick={onArchive}
            className="btn-ghost text-xs py-1.5 px-2.5"
            title="העבר לארכיון"
          >
            <Archive className="w-3.5 h-3.5" />
            ארכיון
          </button>
        )}
        {isArchived && (
          <button
            onClick={onRestore}
            className="btn-ghost text-xs py-1.5 px-2.5"
            title="שחזר מארכיון"
          >
            <ArchiveRestore className="w-3.5 h-3.5" />
            שחזר
          </button>
        )}
        <button
          onClick={onDelete}
          className="btn-ghost text-xs py-1.5 px-2.5 text-danger-600 hover:bg-danger-500/10"
          title="מחיקה"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

function SourceBadge({ source }: { source: ThoughtSource }) {
  const isAudio = source.endsWith("audio");
  const isWhatsapp = source.startsWith("whatsapp");
  const Icon = isAudio ? Mic : MessageSquare;
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
        isWhatsapp
          ? "bg-list-green/15 text-list-green"
          : isAudio
            ? "bg-primary-100 text-primary-700"
            : "bg-ink-100 text-ink-700"
      )}
      title={source}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}

function EmptyState({ status }: { status: ThoughtStatus }) {
  const copy = {
    unprocessed: {
      title: "אין מחשבות ממתינות",
      body: "זרקי רעיון ברגע שעולה — אפשר לעבד אותו אחר כך.",
    },
    processed: {
      title: "עוד לא עיבדת מחשבות",
      body: "כשתהפכי מחשבה למשימה / אירוע / פרויקט, היא תופיע כאן.",
    },
    archived: {
      title: "הארכיון ריק",
      body: "מחשבות שתעבירי לארכיון יישמרו כאן עד 60 יום.",
    },
  }[status];
  return (
    <div className="card p-8 md:p-12 text-center">
      <div className="text-4xl mb-3">💭</div>
      <h2 className="text-lg font-semibold text-ink-900 mb-1">{copy.title}</h2>
      <p className="text-sm text-ink-600">{copy.body}</p>
    </div>
  );
}

function firstLine(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "";
  return line.length > 120 ? line.slice(0, 117) + "…" : line;
}
