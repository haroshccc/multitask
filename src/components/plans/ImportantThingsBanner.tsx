import { useEffect, useState } from "react";
import {
  Star,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronLeft,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCreateImportantItem,
  useAssignTaskToStage,
  useDeletePlanRow,
} from "@/lib/hooks/usePlans";
import type { PlanTask } from "@/lib/types/plans";

/** MIME-ish key carried on the native drag for an "important thing" item. */
export const PLAN_ITEM_DND = "application/x-multitask-plan-item";

interface StageRef {
  id: string;
  title: string;
}

export function ImportantThingsBanner({
  planId,
  items,
  stages,
  canEdit,
}: {
  planId: string;
  items: PlanTask[];
  stages: StageRef[];
  canEdit: boolean;
}) {
  const createItem = useCreateImportantItem();
  const assign = useAssignTaskToStage();
  const deleteRow = useDeletePlanRow();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    createItem.mutate({ planId, title: t });
    setTitle("");
  };

  return (
    <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-3 mb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-0.5 rounded hover:bg-amber-100 text-amber-600 shrink-0"
          aria-label={open ? "כווץ" : "הרחב"}
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <Star className="w-4 h-4 text-amber-500 shrink-0" />
        <h2 className="text-sm font-semibold text-amber-900">דברים שחשובים לנו</h2>
        <span className="text-[11px] bg-amber-200/70 text-amber-800 rounded-full px-1.5 py-0.5">
          {items.length}
        </span>
        <span className="text-[11px] text-amber-700/70 hidden sm:inline ms-1">
          גררי לשלב או לחצי קליק-ימני כדי לשייך
        </span>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2">
          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="מה חשוב לנו?…"
                className="field text-sm py-1.5 flex-1 max-w-md bg-white"
              />
              <button
                type="button"
                onClick={add}
                disabled={!title.trim()}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                הוסף
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-xs text-amber-700/70 px-1 py-1">
              עוד אין כלום כאן. כתבי דברים שחשובים לך — תוכלי לשייך אותם לשלב בתוכנית מאוחר יותר.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PLAN_ITEM_DND, item.id);
                    e.dataTransfer.setData("text/plain", item.title);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onContextMenu={(e) => {
                    if (!canEdit) return;
                    e.preventDefault();
                    setMenu({ taskId: item.id, x: e.clientX, y: e.clientY });
                  }}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-sm text-ink-800 shadow-xs",
                    canEdit && "cursor-grab active:cursor-grabbing"
                  )}
                  title={canEdit ? "גררי לשלב / קליק-ימני לשיוך" : undefined}
                >
                  {canEdit && <GripVertical className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="truncate max-w-[14rem]">{item.title}</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => deleteRow.mutate({ planId, taskId: item.id })}
                      className="opacity-60 group-hover:opacity-100 text-ink-300 hover:text-rose-600 transition-opacity"
                      aria-label="מחק"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Right-click assign menu */}
      {menu && (
        <div
          className="fixed z-[70] bg-white rounded-lg shadow-lift border border-ink-100 py-1 w-52 max-h-64 overflow-y-auto"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
        >
          <div className="px-3 py-1 text-[11px] text-ink-400 flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            שייכי לשלב
          </div>
          {stages.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-ink-400">אין שלבים בתוכנית עדיין</div>
          ) : (
            stages.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  assign.mutate({ planId, taskId: menu.taskId, stageId: s.id });
                  setMenu(null);
                }}
                className="w-full text-start px-3 py-1.5 text-sm text-ink-700 hover:bg-primary-50 truncate"
              >
                {s.title}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}
