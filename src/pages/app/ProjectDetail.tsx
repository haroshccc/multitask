import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  Archive,
  ArchiveRestore,
  Loader2,
  Plus,
  X,
  FileText,
  Save,
  Check,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import {
  useProject,
  useArchiveProject,
  useRestoreProject,
  useDebouncedProjectUpdate,
} from "@/lib/hooks/useProjects";
import type { Project, ProjectPricingMode } from "@/lib/types/domain";
import { PROJECT_WIDGETS } from "@/components/projects/ProjectBlocks";
import { cn } from "@/lib/utils/cn";

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  on_hold: "מושהה",
  completed: "הושלם",
};

export function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);

  if (isLoading) {
    return (
      <ScreenScaffold title="פרויקט">
        <div className="card p-10 text-center text-ink-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          טוענת פרטי פרויקט…
        </div>
      </ScreenScaffold>
    );
  }

  if (isError || !project || !projectId) {
    return (
      <ScreenScaffold title="פרויקט לא נמצא">
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-600 mb-3">
            הפרויקט לא נמצא או שאין לך גישה אליו.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/projects")}
            className="btn-primary text-sm"
          >
            חזרה לפרויקטים
          </button>
        </div>
      </ScreenScaffold>
    );
  }

  return <ProjectDetailLoaded project={project} projectId={projectId} />;
}

function ProjectDetailLoaded({
  project,
  projectId,
}: {
  project: Project;
  projectId: string;
}) {
  const archive = useArchiveProject();
  const restore = useRestoreProject();

  return (
    <ScreenScaffold
      title=""
      actions={
        <>
          {project.is_archived ? (
            <button
              type="button"
              onClick={() => restore.mutate(project.id)}
              disabled={restore.isPending}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <ArchiveRestore className="w-4 h-4" />
              שחזרי
            </button>
          ) : (
            <button
              type="button"
              onClick={() => archive.mutate(project.id)}
              disabled={archive.isPending}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <Archive className="w-4 h-4" />
              ארכבי
            </button>
          )}
        </>
      }
    >
      <ProjectHeader project={project} projectId={projectId} />

      <div className="mt-5">
        <DashboardGrid
          screenKey="project_detail"
          scopeId={projectId}
          widgets={PROJECT_WIDGETS}
        />
      </div>
    </ScreenScaffold>
  );
}

// ─── Project header ─────────────────────────────────────────────────────────

function ProjectHeader({
  project,
  projectId,
}: {
  project: Project;
  projectId: string;
}) {
  const { scheduleUpdate, flush } = useDebouncedProjectUpdate(projectId);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [tags, setTags] = useState<string[]>(project.tags ?? []);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setTags(project.tags ?? []);
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      return;
    }
    scheduleUpdate({ name: trimmed });
    flush();
  };

  const handleDescBlur = () => {
    const next = description.trim() || null;
    if (next === (project.description ?? null)) return;
    scheduleUpdate({ description: next });
    flush();
  };

  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    scheduleUpdate({ tags: next });
    flush();
  };

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v || tags.includes(v)) return;
    const next = [...tags, v];
    setTags(next);
    scheduleUpdate({ tags: next });
    flush();
  };

  return (
    <header className="space-y-2">
      <Link
        to="/app/projects"
        className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 transition-colors"
      >
        <ChevronRight className="w-3.5 h-3.5" />
        חזרה לפרויקטים
      </Link>

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="text-3xl shrink-0 mt-0.5"
          style={{ filter: "saturate(1.1)" }}
        >
          {project.emoji || "📁"}
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full text-2xl md:text-3xl font-bold text-ink-900 bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary-500/25 rounded px-1 -mx-1"
            placeholder="שם פרויקט…"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            rows={1}
            placeholder="הוסיפי תיאור קצר…"
            className="w-full text-sm text-ink-500 bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary-500/25 rounded px-1 -mx-1 mt-1 resize-none"
          />
        </div>

        <PricingActions project={project} projectId={projectId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          {STATUS_LABEL[project.status] ?? project.status}
        </span>
        <TagsRow tags={tags} onRemove={removeTag} onAdd={addTag} />
      </div>
    </header>
  );
}

// ─── Pricing actions (mode toggle + שמרי) ────────────────────────────────

function PricingActions({
  project,
  projectId,
}: {
  project: Project;
  projectId: string;
}) {
  const { scheduleUpdate, flush } = useDebouncedProjectUpdate(projectId);
  const [savedFlash, setSavedFlash] = useState(false);
  const mode = project.pricing_mode;

  const setMode = (m: ProjectPricingMode) => {
    if (m === mode) return;
    scheduleUpdate({ pricing_mode: m });
    flush();
  };

  const handleSave = () => {
    flush();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <ModePill
        active={mode === "fixed_price"}
        onClick={() => setMode("fixed_price")}
      >
        מחיר קבוע
      </ModePill>
      <ModePill active={mode === "hourly"} onClick={() => setMode("hourly")}>
        שעתי
      </ModePill>
      <button
        type="button"
        onClick={() => setMode("quote")}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors",
          "border border-ink-300 bg-white text-ink-700 hover:bg-ink-50",
          mode === "quote" && "border-primary-400 bg-primary-50 text-primary-700",
        )}
      >
        <FileText className="w-3.5 h-3.5" />
        הצעת מחיר
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="btn-primary !py-1.5 !px-3 !text-xs"
        title="שמרי שינויים שעוד לא נשמרו"
      >
        {savedFlash ? (
          <>
            <Check className="w-3.5 h-3.5" />
            נשמר
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5" />
            שמרי
          </>
        )}
      </button>
    </div>
  );
}

function ModePill({
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
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors",
        active
          ? "bg-ink-900 text-white"
          : "bg-ink-100 text-ink-700 hover:bg-ink-200",
      )}
    >
      {children}
    </button>
  );
}

// ─── Tags inline editor ─────────────────────────────────────────────────────

function TagsRow({
  tags,
  onRemove,
  onAdd,
}: {
  tags: string[];
  onRemove: (t: string) => void;
  onAdd: (t: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = () => {
    if (draft.trim()) onAdd(draft);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="chip group flex items-center gap-1"
        >
          {t}
          <button
            type="button"
            onClick={() => onRemove(t)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-400 hover:text-ink-700"
            aria-label={`הסירי תג ${t}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="תג חדש…"
          className="text-xs px-2 py-0.5 rounded-xs border border-ink-300 bg-white outline-none focus:border-primary-500 w-24"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="chip text-ink-500 hover:text-ink-800 hover:bg-ink-200 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          תג
        </button>
      )}
    </div>
  );
}
