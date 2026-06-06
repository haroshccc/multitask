import { useState, useRef, useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
  useOutletContext,
} from "react-router-dom";
import {
  ChevronRight,
  Archive,
  ArchiveRestore,
  Loader2,
  Plus,
  X,
  LayoutDashboard,
  ListTodo,
  CalendarClock,
  CalendarRange,
  Receipt,
  Users,
  FolderOpen,
  FolderKanban,
  Share2,
} from "lucide-react";
import { ListIcon } from "@/components/tasks/list-icons";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  useProject,
  useArchiveProject,
  useRestoreProject,
  useDebouncedProjectUpdate,
} from "@/lib/hooks/useProjects";
import type { Project } from "@/lib/types/domain";
import { ShareProjectModal } from "@/components/projects/ShareProjectModal";
import { cn } from "@/lib/utils/cn";
import { pushUndo } from "@/lib/undo/store";

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  on_hold: "מושהה",
  completed: "הושלם",
};

/** Context handed down to each project sub-screen via <Outlet />. */
export interface ProjectOutletContext {
  project: Project;
  projectId: string;
}

export function useProjectContext(): ProjectOutletContext {
  return useOutletContext<ProjectOutletContext>();
}

const TABS: { to: string; label: string; icon: typeof ListTodo }[] = [
  { to: "tasks", label: "משימות", icon: ListTodo },
  { to: "calendar", label: "יומן", icon: CalendarRange },
  { to: "meetings", label: "פגישות", icon: CalendarClock },
  { to: "payments", label: "תשלומים", icon: Receipt },
  { to: "contacts", label: "אנשי קשר", icon: Users },
  { to: "documents", label: "מסמכים", icon: FolderOpen },
  { to: "dashboard", label: "דשבורד", icon: LayoutDashboard },
];

export function ProjectShell() {
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

  return <ProjectShellLoaded project={project} projectId={projectId} />;
}

function ProjectShellLoaded({
  project,
  projectId,
}: {
  project: Project;
  projectId: string;
}) {
  const archive = useArchiveProject();
  const restore = useRestoreProject();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <ScreenScaffold
      title=""
      actions={
        <>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="btn-ghost text-sm flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            שיתוף
          </button>
          {project.is_archived ? (
            <button
              type="button"
              onClick={() => {
                const id = project.id;
                restore.mutate(id);
                pushUndo({
                  description: "שחזור פרויקט",
                  undo: () => archive.mutate(id),
                  redo: () => restore.mutate(id),
                });
              }}
              disabled={restore.isPending}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <ArchiveRestore className="w-4 h-4" />
              שחזרי
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const id = project.id;
                archive.mutate(id);
                pushUndo({
                  description: "ארכוב פרויקט",
                  undo: () => restore.mutate(id),
                  redo: () => archive.mutate(id),
                });
              }}
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

      <ProjectTabsNav />

      <div className="mt-4">
        <Outlet context={{ project, projectId } satisfies ProjectOutletContext} />
      </div>

      {shareOpen && (
        <ShareProjectModal project={project} onClose={() => setShareOpen(false)} />
      )}
    </ScreenScaffold>
  );
}

function ProjectTabsNav() {
  return (
    <nav className="mt-4 flex items-center gap-1 border-b border-ink-200 overflow-x-auto scrollbar-thin">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              isActive
                ? "border-primary-500 text-primary-700"
                : "border-transparent text-ink-500 hover:text-ink-800 hover:border-ink-300"
            )
          }
        >
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

// ─── Project header (name / description / tags) ──────────────────────────────

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
          className="shrink-0 mt-0.5 inline-flex text-ink-700"
          style={{ filter: "saturate(1.1)" }}
        >
          <ListIcon
            emoji={project.emoji}
            fallback={FolderKanban}
            className="w-8 h-8"
            emojiClassName="text-3xl leading-none"
          />
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
        <span key={t} className="chip group flex items-center gap-1">
          {t}
          <button
            type="button"
            onClick={() => onRemove(t)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-ink-400 hover:text-ink-700"
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
