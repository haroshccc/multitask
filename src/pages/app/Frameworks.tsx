import { useEffect, useState } from "react";
import {
  Plus,
  Share2,
  History,
  Trash2,
  Frame as FrameIcon,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useFrameworks,
  useFrameworkContent,
  useCreateFramework,
  useUpdateFramework,
  useDeleteFramework,
} from "@/lib/hooks/useFrameworks";
import { FrameworkWeekStrip } from "@/components/frameworks/FrameworkWeekStrip";
import { FrameworkMonthGrid } from "@/components/frameworks/FrameworkMonthGrid";
import { ShareFrameworkModal } from "@/components/frameworks/ShareFrameworkModal";
import { FrameworkHistoryModal } from "@/components/frameworks/FrameworkHistoryModal";
import type { Framework } from "@/lib/types/frameworks";
import { DateField } from "@/components/ui/DateField";

const PALETTE = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

export function Frameworks() {
  const { user } = useAuth();
  const { data: frameworks = [], isLoading } = useFrameworks();
  const createFramework = useCreateFramework();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default-select the first framework once loaded.
  useEffect(() => {
    if (!selectedId && frameworks.length > 0) setSelectedId(frameworks[0].id);
    if (selectedId && !frameworks.some((f) => f.id === selectedId)) {
      setSelectedId(frameworks[0]?.id ?? null);
    }
  }, [frameworks, selectedId]);

  const selected = frameworks.find((f) => f.id === selectedId) ?? null;

  const handleCreate = () => {
    const color = PALETTE[frameworks.length % PALETTE.length];
    createFramework.mutate(
      { name: "מסגרת חדשה", color, emoji: null, run_start: null, run_end: null },
      { onSuccess: (fw) => setSelectedId(fw.id) }
    );
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-3 border-b border-ink-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FrameIcon className="w-5 h-5 text-ink-700" />
          <h1 className="text-lg font-semibold text-ink-900">מסגרות</h1>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 text-white text-sm px-3 py-1.5 hover:bg-primary-600"
        >
          <Plus className="w-4 h-4" /> מסגרת חדשה
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Framework rail — horizontal scroll on mobile, vertical column on md+ */}
        <aside className="shrink-0 md:w-56 border-b md:border-b-0 md:border-e border-ink-200 p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto">
          {isLoading && <p className="text-xs text-ink-400 px-2 py-2">טוען…</p>}
          {!isLoading && frameworks.length === 0 && (
            <p className="text-xs text-ink-400 px-2 py-3 leading-relaxed">
              אין מסגרות עדיין. צרי מסגרת חדשה כדי להגדיר לוז קבוע.
            </p>
          )}
          {frameworks.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedId(f.id)}
              className={cn(
                "shrink-0 md:w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-start whitespace-nowrap",
                selectedId === f.id ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
              )}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: f.color ?? "#6366f1" }}
              />
              <span className="truncate md:flex-1 max-w-[40vw] md:max-w-none">
                {f.emoji ? `${f.emoji} ` : ""}
                {f.name}
              </span>
              {f.owner_id !== user?.id && (
                <span className="text-[9px] opacity-70">משותף</span>
              )}
            </button>
          ))}
        </aside>

        {/* Editor */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {selected ? (
            <FrameworkEditorPane
              key={selected.id}
              framework={selected}
              readOnly={selected.owner_id !== user?.id}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-ink-400 text-sm">
              בחרי מסגרת או צרי חדשה
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FrameworkEditorPane({
  framework,
  readOnly,
}: {
  framework: Framework;
  readOnly: boolean;
}) {
  const { data: content } = useFrameworkContent(framework.id);
  const updateFramework = useUpdateFramework();
  const deleteFramework = useDeleteFramework();
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showRange, setShowRange] = useState(!!(framework.run_start || framework.run_end));
  const [name, setName] = useState(framework.name);
  const [editorView, setEditorView] = useState<"week" | "month">("week");
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => setName(framework.name), [framework.id, framework.name]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Settings bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field !py-1.5 text-base font-semibold max-w-xs"
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== framework.name)
              updateFramework.mutate({ id: framework.id, patch: { name: name.trim() } });
          }}
        />

        {!readOnly && (
          <div className="relative">
            <button
              onClick={() => setColorOpen((v) => !v)}
              className="w-6 h-6 rounded-full border-2 border-ink-300 hover:border-ink-500"
              style={{ background: framework.color ?? "#6366f1" }}
              title="צבע המסגרת — לחצי לשינוי"
              aria-label="צבע המסגרת"
            />
            {colorOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setColorOpen(false)} />
                <div className="absolute z-20 mt-1 start-0 p-2 bg-white rounded-xl border border-ink-200 shadow-lift flex items-center gap-1">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        updateFramework.mutate({ id: framework.id, patch: { color: c } });
                        setColorOpen(false);
                      }}
                      className={cn(
                        "w-5 h-5 rounded-full border-2",
                        framework.color === c ? "border-ink-900" : "border-transparent"
                      )}
                      style={{ background: c }}
                      title="צבע"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:bg-ink-100 rounded-xl px-2.5 py-1.5"
        >
          <History className="w-4 h-4" /> היסטוריה
        </button>
        {!readOnly && (
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:bg-ink-100 rounded-xl px-2.5 py-1.5"
          >
            <Share2 className="w-4 h-4" /> שיתוף
          </button>
        )}
        {!readOnly && (
          <button
            onClick={() => {
              if (confirm(`למחוק את "${framework.name}"? פעולה זו אינה הפיכה.`))
                deleteFramework.mutate(framework.id);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-rose-600 hover:bg-rose-50 rounded-xl px-2.5 py-1.5"
          >
            <Trash2 className="w-4 h-4" /> מחיקה
          </button>
        )}
      </div>

      {/* Run horizon */}
      {!readOnly && (
        <div>
          <button
            onClick={() => setShowRange((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showRange && "rotate-180")} />
            טווח ריצה (אופציונלי)
          </button>
          {showRange && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-600">
              <span>מ־</span>
              <DateField
                className="w-36"
                value={framework.run_start ?? ""}
                max={framework.run_end ?? undefined}
                onChange={(v) =>
                  updateFramework.mutate({
                    id: framework.id,
                    patch: { run_start: v || null },
                  })
                }
                label="תחילת תקופה"
              />
              <span>עד</span>
              <DateField
                className="w-36"
                value={framework.run_end ?? ""}
                min={framework.run_start ?? undefined}
                onChange={(v) =>
                  updateFramework.mutate({
                    id: framework.id,
                    patch: { run_end: v || null },
                  })
                }
                label="סוף תקופה"
              />
            </div>
          )}
        </div>
      )}

      {readOnly && (
        <div className="text-xs text-ink-500 bg-ink-50 rounded-xl px-3 py-2">
          מסגרת משותפת — צפייה בלבד.
        </div>
      )}

      {/* View toggle: week (time blocks) / month (day headers) */}
      <div className="inline-flex rounded-xl border border-ink-200 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setEditorView("week")}
          className={cn(
            "px-3 py-1 rounded-lg transition-colors",
            editorView === "week" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
          )}
        >
          שבוע
        </button>
        <button
          type="button"
          onClick={() => setEditorView("month")}
          className={cn(
            "px-3 py-1 rounded-lg transition-colors",
            editorView === "month" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
          )}
        >
          חודש
        </button>
      </div>

      {/* Editor body */}
      {content ? (
        editorView === "week" ? (
          <FrameworkWeekStrip framework={framework} content={content} readOnly={readOnly} />
        ) : (
          <FrameworkMonthGrid framework={framework} content={content} readOnly={readOnly} />
        )
      ) : (
        <p className="text-sm text-ink-400">טוען תוכן…</p>
      )}

      {shareOpen && <ShareFrameworkModal framework={framework} onClose={() => setShareOpen(false)} />}
      {historyOpen && (
        <FrameworkHistoryModal framework={framework} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}
