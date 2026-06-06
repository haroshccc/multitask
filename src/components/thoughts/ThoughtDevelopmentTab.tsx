import { useMemo, useState } from "react";
import { Plus, LayoutGrid, Table as TableIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useThoughtDevelopments,
  useCreateThoughtDevelopment,
  useFilesForDevelopments,
  useSharesForDevelopments,
  useProjects,
  useTaskLists,
  useOrgScope,
} from "@/lib/hooks";
import {
  ThoughtDevelopmentCard,
  formatDevDate,
  type DevCardMeta,
  type DevShareState,
} from "./ThoughtDevelopmentCard";
import { ThoughtDevelopmentEditModal } from "./ThoughtDevelopmentEditModal";

type Layout = "cards" | "table";
type ShareFilter = "all" | "private" | "shared_with_others" | "shared_with_me";

const LAYOUT_KEY = "multitask:thought-dev:layout";

export function ThoughtDevelopmentTab() {
  const scope = useOrgScope();
  const { data: devs = [], isLoading } = useThoughtDevelopments();
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();
  const create = useCreateThoughtDevelopment();

  const ids = useMemo(() => devs.map((d) => d.id), [devs]);
  const { data: files = [] } = useFilesForDevelopments(ids);
  const { data: shares = [] } = useSharesForDevelopments(ids);

  const [layout, setLayout] = useState<Layout>(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem(LAYOUT_KEY) === "table"
      ? "table"
      : "cards"
  );
  const setLayoutPersist = (l: Layout) => {
    setLayout(l);
    if (typeof window !== "undefined") window.localStorage.setItem(LAYOUT_KEY, l);
  };

  // Modal state. `draftId` tracks a freshly-created blank row for cleanup.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  // Filters
  const [shareFilter, setShareFilter] = useState<ShareFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [listFilter, setListFilter] = useState<string>("");

  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name] as const)),
    [projects]
  );
  const listName = useMemo(
    () => new Map(taskLists.map((l) => [l.id, l.name] as const)),
    [taskLists]
  );

  const fileCounts = useMemo(() => {
    const map = new Map<string, { source: number; summary: number }>();
    for (const f of files) {
      const cur = map.get(f.thought_development_id) ?? { source: 0, summary: 0 };
      if (f.role === "source") cur.source += 1;
      else cur.summary += 1;
      map.set(f.thought_development_id, cur);
    }
    return map;
  }, [files]);

  const sharedDevIds = useMemo(
    () => new Set(shares.map((s) => s.entity_id)),
    [shares]
  );

  const shareStateFor = (ownerId: string, devId: string): DevShareState => {
    if (ownerId !== scope.userId) return "shared-with-me";
    return sharedDevIds.has(devId) ? "mine-shared" : "private";
  };

  const metaFor = (devId: string, ownerId: string): DevCardMeta => {
    const counts = fileCounts.get(devId) ?? { source: 0, summary: 0 };
    const dev = devs.find((d) => d.id === devId)!;
    let linkLabel: string | null = null;
    let linkKind: "project" | "list" | null = null;
    if (dev.project_id) {
      linkKind = "project";
      linkLabel = projectName.get(dev.project_id) ?? "פרויקט";
    } else if (dev.task_list_id) {
      linkKind = "list";
      linkLabel = listName.get(dev.task_list_id) ?? "רשימה";
    }
    return {
      sourceCount: counts.source,
      summaryCount: counts.summary,
      shareState: shareStateFor(ownerId, devId),
      linkLabel,
      linkKind,
    };
  };

  const filtered = useMemo(() => {
    return devs.filter((d) => {
      const state = shareStateFor(d.owner_id, d.id);
      if (shareFilter === "private" && state !== "private") return false;
      if (shareFilter === "shared_with_others" && state !== "mine-shared")
        return false;
      if (shareFilter === "shared_with_me" && state !== "shared-with-me")
        return false;
      if (projectFilter && d.project_id !== projectFilter) return false;
      if (listFilter && d.task_list_id !== listFilter) return false;
      return true;
    });
  }, [devs, shareFilter, projectFilter, listFilter, sharedDevIds, scope.userId]);

  const handleNew = async () => {
    const dev = await create.mutateAsync({});
    setDraftId(dev.id);
    setEditingId(dev.id);
  };

  const closeModal = () => {
    setEditingId(null);
    setDraftId(null);
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleNew}
          disabled={create.isPending}
          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-brand-700 disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          פיתוח חדש
        </button>

        {/* Share filter */}
        <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm">
          {(
            [
              ["all", "הכל"],
              ["private", "פרטי"],
              ["shared_with_others", "שיתפתי"],
              ["shared_with_me", "שותף איתי"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setShareFilter(val)}
              className={cn(
                "px-2.5 py-1.5",
                shareFilter === val
                  ? "bg-brand-600 text-white"
                  : "bg-white text-ink-700 hover:bg-ink-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            if (e.target.value) setListFilter("");
          }}
          className="field max-w-[12rem]"
        >
          <option value="">כל הפרויקטים</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={listFilter}
          onChange={(e) => {
            setListFilter(e.target.value);
            if (e.target.value) setProjectFilter("");
          }}
          className="field max-w-[12rem]"
        >
          <option value="">כל הרשימות</option>
          {taskLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {/* Layout toggle */}
        <div className="ms-auto inline-flex rounded-lg border border-ink-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setLayoutPersist("cards")}
            className={cn(
              "px-2.5 py-1.5",
              layout === "cards"
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 hover:bg-ink-50"
            )}
            title="כרטיסיות"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLayoutPersist("table")}
            className={cn(
              "px-2.5 py-1.5",
              layout === "table"
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 hover:bg-ink-50"
            )}
            title="טבלה"
          >
            <TableIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="card px-4 py-10 text-center text-sm text-ink-500">
          טוען…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-4 py-10 text-center text-sm text-ink-500">
          {devs.length === 0
            ? 'אין עדיין פיתוחי מחשבה. לחצו "פיתוח חדש" כדי להתחיל.'
            : "אין פיתוחים שתואמים את הסינון."}
        </div>
      ) : layout === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((d) => (
            <ThoughtDevelopmentCard
              key={d.id}
              dev={d}
              meta={metaFor(d.id, d.owner_id)}
              onOpen={() => setEditingId(d.id)}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead>
              <tr className="border-b border-ink-200 text-ink-500 text-xs">
                <th className="text-start font-medium px-3 py-2">שם</th>
                <th className="text-start font-medium px-3 py-2">תיאור</th>
                <th className="text-start font-medium px-3 py-2">שיוך</th>
                <th className="text-start font-medium px-3 py-2">מקור</th>
                <th className="text-start font-medium px-3 py-2">סיכום</th>
                <th className="text-start font-medium px-3 py-2">שיתוף</th>
                <th className="text-start font-medium px-3 py-2">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const m = metaFor(d.id, d.owner_id);
                return (
                  <tr
                    key={d.id}
                    onClick={() => setEditingId(d.id)}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 font-medium text-ink-900">
                      {d.name || "ללא שם"}
                    </td>
                    <td className="px-3 py-2 text-ink-500 max-w-[16rem] truncate">
                      {d.description}
                    </td>
                    <td className="px-3 py-2 text-ink-600">{m.linkLabel ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{m.sourceCount}</td>
                    <td className="px-3 py-2 tabular-nums">{m.summaryCount}</td>
                    <td className="px-3 py-2 text-ink-600">
                      {m.shareState === "private"
                        ? "פרטי"
                        : m.shareState === "mine-shared"
                        ? "שיתפתי"
                        : "שותף איתי"}
                    </td>
                    <td className="px-3 py-2 text-ink-500 whitespace-nowrap">
                      {formatDevDate(d.written_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ThoughtDevelopmentEditModal
        developmentId={editingId}
        isDraft={!!editingId && editingId === draftId}
        onClose={closeModal}
      />
    </div>
  );
}
