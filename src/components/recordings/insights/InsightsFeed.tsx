import { useMemo, useState } from "react";
import { Layers, ListChecks, Mic, Plus, Search, Sparkles } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
import {
  useRecordingLists,
  useCreateRecordingList,
} from "@/lib/hooks/useRecordingLists";
import { useRecordingsPageCtx } from "@/components/recordings/widgets/context";
import { QuickRecordTallWidget } from "@/components/recordings/widgets/QuickRecordTallWidget";
import { UploadTallWidget } from "@/components/recordings/widgets/UploadTallWidget";
import { InsightCard } from "./InsightCard";
import { CardErrorBoundary } from "./CardErrorBoundary";
import { FilingWizard } from "./FilingWizard";
import type { Recording } from "@/lib/types/domain";

type SourceFilter = "all" | "call" | "meeting";

const SOURCE_CHIPS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "call", label: "שיחות" },
  { value: "meeting", label: "פגישות" },
];

/** Folder key: "all" | "unfiled" | a recording-list id. */
type FolderKey = string;

interface Folder {
  key: FolderKey;
  label: string;
  count: number;
  tone?: "amber";
}

/**
 * Insights view — a reading-width feed of "insight cards" (bottom-lines +
 * cataloging) with a responsive folder rail: a sidebar on desktop, horizontal
 * chips on mobile. Reuses the page's RecordingsPageCtx, and offers one-tap /
 * quick / wizard filing for un-cataloged recordings.
 */
export function InsightsFeed() {
  const ctx = useRecordingsPageCtx();
  const { data: projects = [] } = useProjects();
  const { data: lists = [] } = useRecordingLists();
  const createList = useCreateRecordingList();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [folder, setFolder] = useState<FolderKey>("all");
  const [wizardId, setWizardId] = useState<string | null>(null);

  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);
  const listName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lists) m.set(l.id, l.name);
    return m;
  }, [lists]);

  const isUnfiled = (r: Recording) => {
    const hasList = (ctx.listsByRecording.get(r.id)?.size ?? 0) > 0;
    return (
      !r.project_id && !r.task_list_id && !hasList && (r.tags?.length ?? 0) === 0
    );
  };
  const listNamesFor = (r: Recording) =>
    Array.from(ctx.listsByRecording.get(r.id) ?? [])
      .map((id) => listName.get(id))
      .filter((n): n is string => !!n);

  // Folder counts off the base (source-independent) list, so they stay stable.
  const folders = useMemo<Folder[]>(() => {
    const base = ctx.filteredRecordings;
    const unfiledCount = base.filter(isUnfiled).length;
    const perList = new Map<string, number>();
    for (const r of base) {
      for (const id of ctx.listsByRecording.get(r.id) ?? []) {
        perList.set(id, (perList.get(id) ?? 0) + 1);
      }
    }
    return [
      { key: "all", label: "הכל", count: base.length },
      { key: "unfiled", label: "ממתינות לתיוק", count: unfiledCount, tone: "amber" },
      ...lists.map((l) => ({
        key: l.id,
        label: l.name,
        count: perList.get(l.id) ?? 0,
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.filteredRecordings, ctx.listsByRecording, lists]);

  // Source-filtered + searched rows (search is applied upstream in ctx).
  const rows = useMemo(() => {
    let rs = ctx.filteredRecordings;
    if (sourceFilter !== "all") rs = rs.filter((r) => r.source === sourceFilter);
    return rs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.filteredRecordings, sourceFilter]);

  // Scope rows to the selected folder.
  const scoped = useMemo(() => {
    if (folder === "all") return rows;
    if (folder === "unfiled") return rows.filter(isUnfiled);
    return rows.filter((r) => ctx.listsByRecording.get(r.id)?.has(folder));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, folder, ctx.listsByRecording]);

  const unfiledInScope = useMemo(
    () => scoped.filter(isUnfiled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, ctx.listsByRecording],
  );
  const filedByDay = useMemo(
    () => groupByDay(scoped.filter((r) => !isUnfiled(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, ctx.listsByRecording],
  );
  const scopedByDay = useMemo(() => groupByDay(scoped), [scoped]);

  const wizardRecording = wizardId
    ? ctx.allRecordings.find((r) => r.id === wizardId) ?? null
    : null;

  const createFolder = async (name: string) => {
    const created = await createList.mutateAsync({ name });
    if (created?.id) setFolder(created.id);
  };

  const renderCard = (r: Recording) => (
    <CardErrorBoundary key={r.id} title={r.title}>
      <InsightCard
        recording={r}
        isUnfiled={isUnfiled(r)}
        projectName={r.project_id ? projectName.get(r.project_id) ?? null : null}
        listNames={listNamesFor(r)}
        lists={lists}
        projects={projects}
        onFile={() => setWizardId(r.id)}
      />
    </CardErrorBoundary>
  );

  const activeFolderLabel = folders.find((f) => f.key === folder)?.label ?? "הכל";

  return (
    <div className="mt-5 max-w-5xl mx-auto lg:flex lg:gap-6 lg:items-start">
      {/* Desktop folder sidebar */}
      <FolderSidebar
        folders={folders}
        selected={folder}
        onSelect={setFolder}
        onCreate={createFolder}
        creating={createList.isPending}
        className="hidden lg:block w-56 shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin"
      />

      <div className="flex-1 min-w-0 lg:max-w-3xl">
        {/* Sticky action bar */}
        <div className="sticky top-0 z-20 -mx-1 px-1 pb-3 pt-1 bg-white/85 backdrop-blur">
          <div className="grid grid-cols-2 gap-2 h-14">
            <QuickRecordTallWidget />
            <UploadTallWidget />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-ink-400 absolute end-2 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="חיפוש לפי כותרת…"
                value={ctx.filters.search}
                onChange={(e) =>
                  ctx.setFilters({ ...ctx.filters, search: e.target.value })
                }
                className="field !py-1.5 !text-xs pe-7"
              />
            </div>
            <div className="inline-flex rounded-md bg-ink-100 p-0.5 shrink-0">
              {SOURCE_CHIPS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSourceFilter(c.value)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs transition-colors",
                    sourceFilter === c.value
                      ? "bg-white text-ink-900 shadow-soft font-medium"
                      : "text-ink-600 hover:text-ink-900",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile folder chips */}
          <FolderChips
            folders={folders}
            selected={folder}
            onSelect={setFolder}
            onCreate={createFolder}
            className="lg:hidden mt-2"
          />
        </div>

        {ctx.isLoading ? (
          <FeedSkeleton />
        ) : ctx.allRecordings.length === 0 ? (
          <EmptyState onRecord={ctx.onStartRecording} />
        ) : scoped.length === 0 ? (
          <p className="text-center text-sm text-ink-500 py-10">
            {folder === "all"
              ? "אין הקלטות התואמות את הסינון."
              : `אין הקלטות ב״${activeFolderLabel}״.`}
          </p>
        ) : (
          <div className="space-y-6 pb-12">
            {folder === "all" ? (
              <>
                {unfiledInScope.length > 0 && (
                  <section className="rounded-xl bg-amber-50/60 border border-amber-200 p-3 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <Sparkles className="w-3.5 h-3.5" />
                      ממתינות לתיוק
                      <span className="rounded-full bg-amber-200 text-amber-800 px-1.5 py-0.5 text-[10px]">
                        {unfiledInScope.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {unfiledInScope.map(renderCard)}
                    </div>
                  </section>
                )}
                {filedByDay.map(({ key, label, items }) => (
                  <DaySection key={key} label={label} count={items.length}>
                    {items.map(renderCard)}
                  </DaySection>
                ))}
              </>
            ) : (
              scopedByDay.map(({ key, label, items }) => (
                <DaySection key={key} label={label} count={items.length}>
                  {items.map(renderCard)}
                </DaySection>
              ))
            )}
          </div>
        )}
      </div>

      {wizardRecording && (
        <FilingWizard
          recording={wizardRecording}
          onClose={() => setWizardId(null)}
        />
      )}
    </div>
  );
}

// --- Folder navigation ------------------------------------------------------

function FolderSidebar({
  folders,
  selected,
  onSelect,
  onCreate,
  creating,
  className,
}: {
  folders: Folder[];
  selected: FolderKey;
  onSelect: (k: FolderKey) => void;
  onCreate: (name: string) => void;
  creating: boolean;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-1", className)}>
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        תיקיות
      </div>
      {folders.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onSelect(f.key)}
          className={cn(
            "w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-start transition-colors",
            selected === f.key
              ? "bg-primary-50 text-primary-800 font-medium"
              : "text-ink-700 hover:bg-ink-100",
          )}
        >
          <FolderIcon folder={f} active={selected === f.key} />
          <span className="flex-1 truncate">{f.label}</span>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              f.tone === "amber" && f.count > 0
                ? "text-amber-600 font-semibold"
                : "text-ink-400",
            )}
          >
            {f.count}
          </span>
        </button>
      ))}
      <NewFolderControl variant="sidebar" onCreate={onCreate} busy={creating} />
    </nav>
  );
}

function FolderChips({
  folders,
  selected,
  onSelect,
  onCreate,
  className,
}: {
  folders: Folder[];
  selected: FolderKey;
  onSelect: (k: FolderKey) => void;
  onCreate: (name: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-0.5",
        className,
      )}
    >
      {folders.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onSelect(f.key)}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
            selected === f.key
              ? "border-primary-500 bg-primary-50 text-primary-800 font-medium"
              : f.tone === "amber" && f.count > 0
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-ink-200 bg-white text-ink-600",
          )}
        >
          <FolderIcon folder={f} active={selected === f.key} />
          {f.label}
          <span className="text-[10px] opacity-70">{f.count}</span>
        </button>
      ))}
      <NewFolderControl variant="chips" onCreate={onCreate} busy={false} />
    </div>
  );
}

function FolderIcon({ folder, active }: { folder: Folder; active: boolean }) {
  if (folder.key === "all")
    return <Layers className={cn("w-3.5 h-3.5", active ? "" : "text-ink-400")} />;
  if (folder.key === "unfiled")
    return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
  return (
    <ListChecks className={cn("w-3.5 h-3.5", active ? "" : "text-ink-400")} />
  );
}

function NewFolderControl({
  variant,
  onCreate,
  busy,
}: {
  variant: "sidebar" | "chips";
  onCreate: (name: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    setName("");
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "inline-flex items-center gap-1",
          variant === "sidebar" && "px-1 pt-1",
        )}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !name.trim() && setEditing(false)}
          placeholder="תיקייה חדשה"
          className="field !py-1 !px-2 !text-xs w-32"
          dir="auto"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="rounded-md bg-primary-500 p-1 text-white disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-start text-primary-700 hover:bg-primary-50"
      >
        <Plus className="w-3.5 h-3.5" />
        תיקייה חדשה
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 px-3 py-1 text-xs text-primary-700 hover:bg-primary-50"
    >
      <Plus className="w-3 h-3" />
      תיקייה
    </button>
  );
}

function DaySection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-ink-500 whitespace-nowrap">
          {label}
        </span>
        <span className="h-px flex-1 bg-ink-150" aria-hidden />
        <span className="text-[10px] text-ink-400">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function groupByDay(rows: Recording[]) {
  const groups = new Map<string, Recording[]>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = format(d, "yyyy-MM-dd");
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(r);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => {
      const d = new Date(items[0].created_at);
      const label = isToday(d)
        ? "היום"
        : isYesterday(d)
          ? "אתמול"
          : format(d, "EEEE, d בMMMM", { locale: he });
      return { key, label, items };
    });
}

function FeedSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-ink-200 bg-white p-4 space-y-3"
        >
          <div className="h-4 w-1/3 rounded bg-ink-100 animate-pulse" />
          <div className="h-3 w-full rounded bg-ink-100 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-ink-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onRecord }: { onRecord: () => void }) {
  return (
    <div className="text-center py-16 flex flex-col items-center">
      <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
        <Mic className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-semibold text-ink-900">עוד אין הקלטות</h2>
      <p className="text-sm text-ink-600 mt-1 max-w-sm leading-relaxed">
        הקליטי שיחה או גררי קובץ — הסיכום והתיוק יקרו אוטומטית.
      </p>
      <button
        type="button"
        onClick={onRecord}
        className="btn-primary mt-4 inline-flex items-center gap-1.5"
      >
        <Mic className="w-4 h-4" />
        הקלטה חדשה
      </button>
    </div>
  );
}
