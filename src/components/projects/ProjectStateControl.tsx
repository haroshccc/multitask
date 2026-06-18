import { useState, useRef, useEffect } from "react";
import { Power, Check, ChevronDown } from "lucide-react";
import { useUpdateProject } from "@/lib/hooks/useProjects";
import { pushUndo } from "@/lib/undo/store";
import { cn } from "@/lib/utils/cn";
import type { Project } from "@/lib/types/domain";
import {
  getProjectState,
  projectStatePatch,
  PROJECT_STATE_LABEL,
  PROJECT_STATE_ORDER,
  type ProjectState,
} from "@/lib/projects/state";

const STATE_STYLE: Record<ProjectState, string> = {
  active: "border-success-300 bg-success-50 text-success-700 hover:bg-success-100",
  inactive: "border-ink-200 bg-ink-50 text-ink-400 hover:bg-ink-100",
  completed: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
};

/**
 * Three-way project state selector (פעיל / לא פעיל / הושלם), shared by the
 * project card, table row and detail header. Writes via useUpdateProject and
 * registers an undo entry.
 */
export function ProjectStateControl({
  project,
  size = "sm",
}: {
  project: Project;
  size?: "sm" | "md";
}) {
  const update = useUpdateProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const state = getProjectState(project);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const choose = (next: ProjectState, e: React.MouseEvent) => {
    stop(e);
    setOpen(false);
    if (next === state) return;
    const id = project.id;
    const before = { status: project.status, is_active: project.is_active };
    update.mutate({ projectId: id, patch: projectStatePatch(next) });
    pushUndo({
      description: "שינוי מצב פרויקט",
      undo: () => update.mutate({ projectId: id, patch: before }),
      redo: () => update.mutate({ projectId: id, patch: projectStatePatch(next) }),
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border font-medium transition-colors",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1.5 text-sm",
          STATE_STYLE[state]
        )}
        title="מצב הפרויקט"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Power className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
        {PROJECT_STATE_LABEL[state]}
        <ChevronDown className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </button>
      {open && (
        <div
          onClick={stop}
          className="absolute end-0 top-full mt-1 z-30 min-w-[140px] bg-white border border-ink-200 rounded-lg shadow-lift py-1"
          role="listbox"
        >
          {PROJECT_STATE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => choose(s, e)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50"
              role="option"
              aria-selected={s === state}
            >
              <span>{PROJECT_STATE_LABEL[s]}</span>
              {s === state && <Check className="w-3.5 h-3.5 text-ink-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
