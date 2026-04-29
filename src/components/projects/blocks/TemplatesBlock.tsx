import { Loader2, Star, Sparkles, Save } from "lucide-react";
import {
  useProjectTemplates,
  useApplyProjectTemplate,
  useSaveProjectAsTemplate,
  useProject,
} from "@/lib/hooks";

export function TemplatesBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: templates = [], isLoading } = useProjectTemplates();
  const { data: project } = useProject(projectId);
  const apply = useApplyProjectTemplate();
  const saveAs = useSaveProjectAsTemplate();

  const onApply = (templateId: string, name: string) => {
    if (!projectId) return;
    if (
      !confirm(
        `לטעון את התבנית "${name}"? תיווצר רשימת משימות חדשה תחת הפרויקט.`
      )
    )
      return;
    apply.mutate({ templateId, projectId });
  };

  const onSaveAs = () => {
    if (!projectId) return;
    const defaultName = project?.name
      ? `${project.name} — תבנית`
      : "תבנית חדשה";
    const name = window.prompt("שם התבנית החדשה:", defaultName);
    if (!name?.trim()) return;
    saveAs.mutate({
      projectId,
      name: name.trim(),
      description: project?.description ?? null,
      emoji: project?.emoji ?? null,
    });
  };

  if (isLoading) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      <button
        type="button"
        onClick={onSaveAs}
        disabled={!projectId || saveAs.isPending}
        className="rounded-lg border-2 border-dashed border-ink-300 bg-ink-50/40 p-3 flex flex-col items-center justify-center gap-1.5 hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-700 transition-all text-ink-500 disabled:opacity-50 min-h-[120px]"
      >
        {saveAs.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        <span className="text-xs font-medium">
          {saveAs.isPending ? "שומרת…" : "שמרי כתבנית"}
        </span>
        <span className="text-[10px] opacity-75">
          המשימות שלך → תבנית חדשה
        </span>
      </button>
      {templates.length === 0 && !isLoading && (
        <div className="col-span-full text-center py-4">
          <Sparkles className="w-5 h-5 text-ink-400 mx-auto mb-2" />
          <p className="text-xs text-ink-500">
            עוד אין תבניות. הוסיפי משימות לפרויקט ושמרי כתבנית.
          </p>
        </div>
      )}
      {templates.map((tpl) => {
        const data = (tpl.template_data as { tasks?: { title: string }[] }) ?? {};
        const taskCount = data.tasks?.length ?? 0;
        return (
          <article
            key={tpl.id}
            className="rounded-lg border border-ink-200 bg-white p-3 flex flex-col gap-2 hover:border-primary-300 hover:shadow-soft transition-all"
          >
            <header className="flex items-start gap-2">
              <span className="text-xl shrink-0" aria-hidden>
                {tpl.emoji ?? "📁"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-ink-900 truncate">
                    {tpl.name}
                  </h4>
                  {tpl.is_favorite && (
                    <Star className="w-3 h-3 fill-primary-500 text-primary-500 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-ink-500">
                  {taskCount} משימות
                </p>
              </div>
            </header>
            {tpl.description && (
              <p className="text-[11px] text-ink-600 leading-snug line-clamp-2">
                {tpl.description}
              </p>
            )}
            <button
              type="button"
              onClick={() => onApply(tpl.id, tpl.name)}
              disabled={apply.isPending || !projectId}
              className="btn-outline text-xs py-1 mt-auto"
            >
              {apply.isPending ? "טוען…" : "טען לפרויקט"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
