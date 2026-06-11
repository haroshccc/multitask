import { useMemo, useState } from "react";
import { Mic, Search, Sparkles } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { useProjects } from "@/lib/hooks/useProjects";
import { useRecordingLists } from "@/lib/hooks/useRecordingLists";
import { useRecordingsPageCtx } from "@/components/recordings/widgets/context";
import { QuickRecordTallWidget } from "@/components/recordings/widgets/QuickRecordTallWidget";
import { UploadTallWidget } from "@/components/recordings/widgets/UploadTallWidget";
import { InsightCard } from "./InsightCard";
import { FilingWizard } from "./FilingWizard";
import type { Recording } from "@/lib/types/domain";

type SourceFilter = "all" | "call" | "meeting";

const SOURCE_CHIPS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "call", label: "שיחות" },
  { value: "meeting", label: "פגישות" },
];

/**
 * Insights view — a reading-width feed of "insight cards": bottom-lines +
 * cataloging instead of raw audio files. Reuses the page's RecordingsPageCtx
 * (so filteredRecordings / record / upload all work) and surfaces a guided
 * FilingWizard for un-cataloged recordings.
 */
export function InsightsFeed() {
  const ctx = useRecordingsPageCtx();
  const { data: projects = [] } = useProjects();
  const { data: lists = [] } = useRecordingLists();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
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
      !r.project_id &&
      !r.task_list_id &&
      !hasList &&
      (r.tags?.length ?? 0) === 0
    );
  };
  const listNamesFor = (r: Recording) =>
    Array.from(ctx.listsByRecording.get(r.id) ?? [])
      .map((id) => listName.get(id))
      .filter((n): n is string => !!n);

  const rows = useMemo(() => {
    let rs = ctx.filteredRecordings;
    if (sourceFilter !== "all") rs = rs.filter((r) => r.source === sourceFilter);
    return rs;
  }, [ctx.filteredRecordings, sourceFilter]);

  const unfiled = useMemo(() => rows.filter(isUnfiled), [rows, ctx.listsByRecording]);
  const filedByDay = useMemo(() => {
    const filed = rows.filter((r) => !isUnfiled(r));
    return groupByDay(filed);
  }, [rows, ctx.listsByRecording]);

  const wizardRecording = wizardId
    ? ctx.allRecordings.find((r) => r.id === wizardId) ?? null
    : null;

  const renderCard = (r: Recording) => (
    <InsightCard
      key={r.id}
      recording={r}
      isUnfiled={isUnfiled(r)}
      projectName={r.project_id ? projectName.get(r.project_id) ?? null : null}
      listNames={listNamesFor(r)}
      onFile={() => setWizardId(r.id)}
    />
  );

  return (
    <div className="mt-5 max-w-3xl mx-auto">
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
      </div>

      {ctx.isLoading ? (
        <FeedSkeleton />
      ) : ctx.allRecordings.length === 0 ? (
        <EmptyState onRecord={ctx.onStartRecording} />
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-ink-500 py-10">
          אין הקלטות התואמות את הסינון.
        </p>
      ) : (
        <div className="space-y-6 pb-12">
          {/* Waiting-to-file section */}
          {unfiled.length > 0 && (
            <section className="rounded-xl bg-amber-50/60 border border-amber-200 p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Sparkles className="w-3.5 h-3.5" />
                ממתינות לתיוק
                <span className="rounded-full bg-amber-200 text-amber-800 px-1.5 py-0.5 text-[10px]">
                  {unfiled.length}
                </span>
              </div>
              <div className="space-y-3">{unfiled.map(renderCard)}</div>
            </section>
          )}

          {/* Day groups */}
          {filedByDay.map(({ key, label, items }) => (
            <section key={key} className="space-y-3">
              <h3 className="sticky top-[7.5rem] z-10 text-xs font-semibold text-ink-500 bg-white/85 backdrop-blur py-1">
                {label}
              </h3>
              <div className="space-y-3">{items.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}

      {wizardRecording && (
        <FilingWizard
          recording={wizardRecording}
          onClose={() => setWizardId(null)}
        />
      )}
    </div>
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
        <div key={i} className="rounded-xl border border-ink-200 bg-white p-4 space-y-3">
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
