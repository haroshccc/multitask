import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Archive, ArchiveRestore } from "lucide-react";
import { useArchiveProject, useRestoreProject } from "@/lib/hooks/useProjects";
import type { Project } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { ListIcon } from "@/components/tasks/list-icons";

interface Props {
  project: Project;
}

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  on_hold: "מושהה",
  completed: "הושלם",
  archived: "בארכיון",
};

export function ProjectCard({ project }: Props) {
  const archive = useArchiveProject();
  const restore = useRestoreProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onArchive = (e: React.MouseEvent) => {
    stop(e);
    setMenuOpen(false);
    const id = project.id;
    archive.mutate(id);
    pushUndo({
      description: "ארכוב פרויקט",
      undo: () => restore.mutate(id),
      redo: () => archive.mutate(id),
    });
  };

  const onRestore = (e: React.MouseEvent) => {
    stop(e);
    setMenuOpen(false);
    const id = project.id;
    restore.mutate(id);
    pushUndo({
      description: "שחזור פרויקט",
      undo: () => archive.mutate(id),
      redo: () => restore.mutate(id),
    });
  };

  const accent = project.color ?? "#a8a8bc";

  return (
    <Link
      to={`/app/projects/${project.id}`}
      className="card-lift relative block p-4 group"
    >
      {/* Color stripe */}
      <span
        className="absolute top-0 start-0 end-0 h-1 rounded-t-lg"
        style={{ backgroundColor: accent }}
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {project.emoji && (
            <span className="shrink-0 inline-flex text-ink-700" aria-hidden>
              <ListIcon
                emoji={project.emoji}
                className="w-5 h-5"
                emojiClassName="text-xl leading-none"
              />
            </span>
          )}
          <h3 className="text-base font-semibold text-ink-900 truncate">
            {project.name}
          </h3>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setMenuOpen((v) => !v);
            }}
            className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
            aria-label="פעולות"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              onClick={stop}
              className="absolute end-0 top-full mt-1 z-20 bg-white border border-ink-200 rounded-lg shadow-lift min-w-[160px] py-1"
            >
              {project.is_archived ? (
                <button
                  type="button"
                  onClick={onRestore}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  שחזרי מארכיון
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onArchive}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  ארכבי
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <p className="text-xs text-ink-500 line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {project.status && project.status !== "active" && (
          <span className="chip">{STATUS_LABEL[project.status] ?? project.status}</span>
        )}
        {project.tags?.slice(0, 3).map((t) => (
          <span key={t} className="chip-accent">
            {t}
          </span>
        ))}
        {project.tags && project.tags.length > 3 && (
          <span className="text-[10px] text-ink-400">
            +{project.tags.length - 3}
          </span>
        )}
      </div>
    </Link>
  );
}
