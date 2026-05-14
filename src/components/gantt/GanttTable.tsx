import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  GripVertical,
  Link2,
  Settings2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCompleteTask,
  useCreateTaskDependency,
  useDeleteTaskDependency,
  useUpdateTask,
  useUpdateTaskDependency,
} from "@/lib/hooks/useTasks";
import {
  GANTT_STANDARD_COLUMNS,
  useGanttColumnPrefs,
} from "@/lib/hooks/useGanttColumnPrefs";
import {
  useIsTaskSelected,
  useTaskSelectionStore,
} from "@/lib/selection/store";
import { pushUndo } from "@/lib/undo/store";
import type { Task, TaskCustomField, TaskDependency } from "@/lib/types/domain";
import type { GanttRow } from "./gantt-utils";

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 64;

function stripHtml(html: string): string {
  if (typeof document === "undefined" || !html) return html ?? "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

function computePercentMap(rows: GanttRow[]): Map<string, number> {
  const taskRows = rows.filter((r) => r.kind === "task" && r.task && !r.isPhase);
  const childrenOf = new Map<string, string[]>();
  for (const r of taskRows) {
    const parentId = r.task!.parent_task_id ?? "__root__";
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(r.task!.id);
  }
  const taskById = new Map<string, GanttRow>();
  for (const r of taskRows) taskById.set(r.task!.id, r);

  const memo = new Map<string, number>();
  function getPercent(taskId: string): number {
    if (memo.has(taskId)) return memo.get(taskId)!;
    const children = childrenOf.get(taskId) ?? [];
    const pct =
      children.length === 0
        ? taskById.get(taskId)?.task?.completed_at ? 100 : 0
        : Math.round(children.reduce((s, c) => s + getPercent(c), 0) / children.length);
    memo.set(taskId, pct);
    return pct;
  }
  for (const id of taskById.keys()) getPercent(id);
  return memo;
}

function computeWbs(rows: GanttRow[]): Map<string, string> {
  const map = new Map<string, string>();
  const counters: number[] = [];
  for (const row of rows) {
    if (row.kind !== "task" || !row.task) continue;
    const depth = row.depth;
    while (counters.length <= depth) counters.push(0);
    counters[depth] = (counters[depth] ?? 0) + 1;
    counters.length = depth + 1;
    map.set(row.task.id, counters.join("."));
  }
  return map;
}

function buildGridTemplate(
  cols: ReturnType<typeof useGanttColumnPrefs>,
  visibleCustomFields: TaskCustomField[],
  multipleListsVisible: boolean
): string {
  const parts = ["80px", "40px", "minmax(200px,1fr)"];
  if (cols.isVisible("description")) parts.push("minmax(120px,1fr)");
  if (cols.isVisible("notes")) parts.push("minmax(120px,1fr)");
  if (multipleListsVisible && cols.isVisible("task_list")) parts.push("90px");
  if (cols.isVisible("urgency")) parts.push("56px");
  if (cols.isVisible("status")) parts.push("96px");
  if (cols.isVisible("scheduled_at")) parts.push("100px");
  if (cols.isVisible("end_date")) parts.push("100px");
  if (cols.isVisible("deadline_at")) parts.push("100px");
  if (cols.isVisible("duration_minutes")) parts.push("72px");
  if (cols.isVisible("dependencies")) parts.push("80px");
  if (cols.isVisible("percent_complete")) parts.push("72px");
  for (let i = 0; i < visibleCustomFields.length; i++) parts.push("120px");
  parts.push("32px");
  return parts.join(" ");
}

interface GanttTableProps {
  rows: GanttRow[];
  deps: TaskDependency[];
  criticalSet: Set<string>;
  onRowClick: (row: GanttRow) => void;
  layout: "side" | "stacked";
  onCreateTask?: (title: string) => Promise<void> | void;
  customFields?: TaskCustomField[];
  lists?: Array<{ id: string; name: string }>;
  onToggleCritical?: (taskId: string, critical: boolean) => void;
  /** Full hierarchy (post critical-filter, pre collapse-filter). Used for
   *  WBS numbering and rolled-up % so collapsing a phase doesn't skew them. */
  allRows?: GanttRow[];
  /** Collapsed parent task ids — drives the chevron state. */
  collapsedIds?: Set<string>;
  /** Toggle a parent row's collapsed state. */
  onToggleCollapsed?: (taskId: string) => void;
  /** Register the scroll container into the page-level vertical scroll-sync
   *  group so the table stays row-aligned with the Gantt grid. */
  registerScroll?: (el: HTMLElement) => () => void;
}

export function GanttTable({
  rows,
  deps,
  criticalSet,
  onRowClick,
  layout,
  onCreateTask,
  customFields = [],
  lists = [],
  onToggleCritical,
  allRows,
  collapsedIds,
  onToggleCollapsed,
  registerScroll,
}: GanttTableProps) {
  const baseRows = allRows ?? rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!registerScroll || !scrollRef.current) return;
    return registerScroll(scrollRef.current);
  }, [registerScroll]);
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const createDep = useCreateTaskDependency();
  const deleteDep = useDeleteTaskDependency();
  const updateDep = useUpdateTaskDependency();
  const [newTitle, setNewTitle] = useState("");
  const cols = useGanttColumnPrefs();
  const [colMgrOpen, setColMgrOpen] = useState(false);

  const multipleListsVisible = useMemo(() => {
    const listIds = new Set<string>();
    for (const r of rows) {
      if (r.kind === "task" && r.task?.task_list_id) {
        listIds.add(r.task.task_list_id);
      }
    }
    return listIds.size > 1;
  }, [rows]);

  const listNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lists) m.set(l.id, l.name);
    return m;
  }, [lists]);

  const wbsNumbers = useMemo(() => computeWbs(baseRows), [baseRows]);
  const percentMap = useMemo(() => computePercentMap(baseRows), [baseRows]);

  const visibleCustomFields = useMemo(
    () => customFields.filter((cf) => cols.isVisible(cf.id)),
    [customFields, cols]
  );
  const gridTemplate = useMemo(
    () => buildGridTemplate(cols, visibleCustomFields, multipleListsVisible),
    [cols, visibleCustomFields, multipleListsVisible]
  );

  const depsByTask = useMemo(() => {
    const m = new Map<string, TaskDependency[]>();
    for (const d of deps) {
      const arr = m.get(d.task_id) ?? [];
      arr.push(d);
      m.set(d.task_id, arr);
    }
    return m;
  }, [deps]);

  const visibleTaskMap = useMemo(() => {
    const m = new Map<string, GanttRow>();
    for (const r of baseRows) {
      if (r.kind === "task" && r.task) m.set(r.task.id, r);
    }
    return m;
  }, [baseRows]);

  const update = (
    taskId: string,
    patch: Partial<Task>,
    description: string,
    prev: Partial<Task>
  ) => {
    updateTask.mutate({ taskId, patch });
    pushUndo({
      description,
      undo: () => updateTask.mutate({ taskId, patch: prev }),
      redo: () => updateTask.mutate({ taskId, patch }),
    });
  };

  return (
    <div className="card overflow-hidden">
      {/* Plain-block scroll container — a block element's width is always its
          containing block's width, never content-driven, so the card can
          never be widened past the page by a wide grid. Horizontal overflow
          scrolls *inside* here. */}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-auto scrollbar-thin",
          layout === "stacked" ? "max-h-[40vh]" : "max-h-[calc(100vh-200px)]"
        )}
      >
        {/* w-full → the grid always fits its container width; the flexible
            (1fr) columns absorb the slack so the table fills the page instead
            of forcing a horizontal scrollbar. */}
        <div role="table" className="w-full text-[12px] tabular-nums">
          <div
            role="rowgroup"
            className="sticky top-0 z-10 bg-ink-50/95 backdrop-blur-sm border-b border-ink-200"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              role="row"
              className="grid items-center h-full"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div role="columnheader" className="px-1 py-2" aria-label="פעולות שורה" />
              <div role="columnheader" className="text-center font-semibold text-ink-500 px-1 py-2 text-[10px]">
                WBS
              </div>
              <div role="columnheader" className="text-start font-semibold text-ink-700 px-2 py-2 min-w-[200px]">
                <ColumnHeader id="title" label={cols.getLabel("title", "משימה")} onRename={(l) => cols.renameColumn("title", l)} align="start" />
              </div>
              {cols.isVisible("description") && (
                <div role="columnheader" className="text-start font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="description" label={cols.getLabel("description", "תיאור")} onRename={(l) => cols.renameColumn("description", l)} align="start" />
                </div>
              )}
              {cols.isVisible("notes") && (
                <div role="columnheader" className="text-start font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="notes" label={cols.getLabel("notes", "הערות")} onRename={(l) => cols.renameColumn("notes", l)} align="start" />
                </div>
              )}
              {multipleListsVisible && cols.isVisible("task_list") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="task_list" label={cols.getLabel("task_list", "רשימה")} onRename={(l) => cols.renameColumn("task_list", l)} />
                </div>
              )}
              {cols.isVisible("urgency") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="urgency" label={cols.getLabel("urgency", "דחיפות")} onRename={(l) => cols.renameColumn("urgency", l)} />
                </div>
              )}
              {cols.isVisible("status") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="status" label={cols.getLabel("status", "סטאטוס")} onRename={(l) => cols.renameColumn("status", l)} />
                </div>
              )}
              {cols.isVisible("scheduled_at") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="scheduled_at" label={cols.getLabel("scheduled_at", "התחלה")} onRename={(l) => cols.renameColumn("scheduled_at", l)} />
                </div>
              )}
              {cols.isVisible("end_date") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="end_date" label={cols.getLabel("end_date", "סיום")} onRename={(l) => cols.renameColumn("end_date", l)} />
                </div>
              )}
              {cols.isVisible("deadline_at") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="deadline_at" label={cols.getLabel("deadline_at", "דד-ליין")} onRename={(l) => cols.renameColumn("deadline_at", l)} />
                </div>
              )}
              {cols.isVisible("duration_minutes") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="duration_minutes" label={cols.getLabel("duration_minutes", "משך (ד׳)")} onRename={(l) => cols.renameColumn("duration_minutes", l)} />
                </div>
              )}
              {cols.isVisible("dependencies") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="dependencies" label={cols.getLabel("dependencies", "תלויות")} onRename={(l) => cols.renameColumn("dependencies", l)} />
                </div>
              )}
              {cols.isVisible("percent_complete") && (
                <div role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id="percent_complete" label={cols.getLabel("percent_complete", "% סיום")} onRename={(l) => cols.renameColumn("percent_complete", l)} />
                </div>
              )}
              {visibleCustomFields.map((cf) => (
                <div key={cf.id} role="columnheader" className="text-center font-semibold text-ink-700 px-1 py-2">
                  <ColumnHeader id={cf.id} label={cols.getLabel(cf.id, cf.field_label)} onRename={(l) => cols.renameColumn(cf.id, l)} />
                </div>
              ))}
              <div role="columnheader" className="flex items-center justify-center px-0 py-0">
                <div className="relative">
                  <button type="button" onClick={() => setColMgrOpen((v) => !v)} className="p-1 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100" title="ניהול עמודות" aria-label="ניהול עמודות">
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  {colMgrOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setColMgrOpen(false)} />
                      <div className="absolute end-0 mt-1 z-40 w-56 bg-white border border-ink-200 rounded-xl shadow-lift py-1">
                        <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">עמודות גלויות</div>
                        {GANTT_STANDARD_COLUMNS.filter((c) => !c.alwaysVisible).map((c) => {
                          const visible = cols.isVisible(c.id);
                          return (
                            <button key={c.id} type="button" onClick={() => cols.toggleVisible(c.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50">
                              <span className={cn("w-3 h-3 rounded-sm border flex items-center justify-center shrink-0", visible ? "bg-primary-500 border-primary-500" : "border-ink-300 bg-white")}>
                                {visible && (<svg viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2 text-white"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z" clipRule="evenodd" /></svg>)}
                              </span>
                              <span className="flex-1 truncate">{cols.getLabel(c.id, c.defaultLabel)}</span>
                            </button>
                          );
                        })}
                        {customFields.length > 0 && (
                          <>
                            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-t border-ink-100 mt-1">שדות מותאמים אישית</div>
                            {customFields.map((cf) => {
                              const visible = cols.isVisible(cf.id);
                              return (
                                <button key={cf.id} type="button" onClick={() => { if (visible) { cols.toggleVisible(cf.id); } else { cols.enableCustomField(cf.id); } }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50">
                                  <span className={cn("w-3 h-3 rounded-sm border flex items-center justify-center shrink-0", visible ? "bg-primary-500 border-primary-500" : "border-ink-300 bg-white")}>
                                    {visible && (<svg viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2 text-white"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z" clipRule="evenodd" /></svg>)}
                                  </span>
                                  <span className="flex-1 truncate">{cols.getLabel(cf.id, cf.field_label)}</span>
                                </button>
                              );
                            })}
                          </>
                        )}
                        <div className="text-[10px] text-ink-400 px-3 py-1.5 border-t border-ink-100 mt-1">לחיצה כפולה על כותרת עמודה לשינוי השם</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div role="rowgroup">
            {rows.map((r) => (
              <GanttTableBodyRow
                key={r.id}
                row={r}
                gridTemplate={gridTemplate}
                cols={cols}
                criticalSet={criticalSet}
                taskDeps={depsByTask.get(r.task?.id ?? "") ?? []}
                visibleTaskMap={visibleTaskMap}
                visibleCustomFields={visibleCustomFields}
                onRowClick={onRowClick}
                onUpdate={update}
                onComplete={(taskId, completed) => completeTask.mutate({ taskId, completed })}
                onAddDep={
                  r.kind === "task" && r.task
                    ? (predecessorId, relation, lagDays) =>
                        createDep.mutate({ taskId: r.task!.id, dependsOnTaskId: predecessorId, relation, lagDays })
                    : undefined
                }
                onRemoveDep={(depId) => deleteDep.mutate(depId)}
                onUpdateDep={(depId, patch) => updateDep.mutate({ depId, patch })}
                onToggleCritical={onToggleCritical}
                multipleListsVisible={multipleListsVisible}
                wbsNumber={r.task ? wbsNumbers.get(r.task.id) : undefined}
                percentComplete={r.task ? percentMap.get(r.task.id) : undefined}
                listName={r.task?.task_list_id ? listNameMap.get(r.task.task_list_id) : undefined}
                collapsedIds={collapsedIds}
                onToggleCollapsed={onToggleCollapsed}
              />
            ))}
          </div>

          {onCreateTask && (
            <div role="row" className="grid border-b border-ink-150 bg-primary-50/40 hover:bg-primary-50" style={{ gridTemplateColumns: gridTemplate, height: ROW_HEIGHT }}>
              <div role="cell" className="col-span-full px-4 flex items-center gap-2" style={{ gridColumn: "1 / -1" }}>
                <span className="text-primary-600 text-sm">+</span>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") { const t = newTitle.trim(); if (!t) return; await onCreateTask(t); setNewTitle(""); }
                    if (e.key === "Escape") setNewTitle("");
                  }}
                  onBlur={async () => { const t = newTitle.trim(); if (!t) return; await onCreateTask(t); setNewTitle(""); }}
                  placeholder="הוספת משימה חדשה..."
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm placeholder:text-ink-400 py-0.5"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface GanttTableBodyRowProps {
  row: GanttRow;
  gridTemplate: string;
  cols: ReturnType<typeof useGanttColumnPrefs>;
  criticalSet: Set<string>;
  taskDeps: TaskDependency[];
  visibleTaskMap: Map<string, GanttRow>;
  visibleCustomFields: TaskCustomField[];
  onRowClick: (row: GanttRow) => void;
  onUpdate: (taskId: string, patch: Partial<Task>, description: string, prev: Partial<Task>) => void;
  onComplete: (taskId: string, completed: boolean) => void;
  onAddDep?: (predecessorId: string, relation?: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish", lagDays?: number) => void;
  onRemoveDep: (depId: string) => void;
  onUpdateDep: (depId: string, patch: { relation?: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish"; lag_days?: number }) => void;
  onToggleCritical?: (taskId: string, critical: boolean) => void;
  multipleListsVisible: boolean;
  wbsNumber?: string;
  percentComplete?: number;
  listName?: string;
  collapsedIds?: Set<string>;
  onToggleCollapsed?: (taskId: string) => void;
}

function GanttTableBodyRow({
  row, gridTemplate, cols, criticalSet, taskDeps, visibleTaskMap, visibleCustomFields,
  onRowClick, onUpdate, onComplete, onAddDep, onRemoveDep, onUpdateDep, onToggleCritical,
  multipleListsVisible, wbsNumber, percentComplete, listName,
  collapsedIds, onToggleCollapsed,
}: GanttTableBodyRowProps) {
  const isTask = row.kind === "task" && !!row.task;
  const isCritical = isTask && criticalSet.has(row.task!.id);
  const isPhase = !!row.isPhase;
  const isEvent = row.kind === "event";
  const isUnscheduled = !!row.unscheduled;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `gantt-task:${row.id}`,
    data: { type: "gantt-task", taskId: row.task?.id, listId: row.task?.task_list_id ?? null, parentTaskId: row.task?.parent_task_id ?? null },
    disabled: !isTask,
  });
  const { setNodeRef: setBeforeRef, isOver: isOverBefore } = useDroppable({
    id: `gantt-before:${row.id}`,
    data: { type: "gantt-task-before", taskId: row.task?.id, listId: row.task?.task_list_id ?? null, parentTaskId: row.task?.parent_task_id ?? null },
    disabled: !isTask,
  });
  const { setNodeRef: setNestRef, isOver: isOverNest } = useDroppable({
    id: `gantt-nest:${row.id}`,
    data: { type: "gantt-task-nest", taskId: row.task?.id, listId: row.task?.task_list_id ?? null },
    disabled: !isTask,
  });
  const { setNodeRef: setAfterRef, isOver: isOverAfter } = useDroppable({
    id: `gantt-after:${row.id}`,
    data: { type: "gantt-task-after", taskId: row.task?.id, listId: row.task?.task_list_id ?? null, parentTaskId: row.task?.parent_task_id ?? null },
    disabled: !isTask,
  });

  return (
    <div
      ref={setDragRef}
      role="row"
      className={cn(
        "relative grid border-b border-ink-150 hover:bg-ink-100 group/sel",
        isUnscheduled ? "bg-ink-100" : "bg-white",
        row.completed && "opacity-60",
        isCritical && "bg-danger-500/5",
        isPhase && !isUnscheduled && "bg-ink-50/60 font-semibold",
        isPhase && isUnscheduled && "font-semibold",
        isDragging && "opacity-40",
        isOverNest && !isDragging && "bg-primary-50 ring-1 ring-inset ring-primary-300"
      )}
      style={{
        height: ROW_HEIGHT,
        gridTemplateColumns: gridTemplate,
        ...(isPhase ? ({ borderInlineStartWidth: 4, borderInlineStartColor: row.accentColor ?? "#6b6b80" } as React.CSSProperties) : {}),
      }}
      onDoubleClick={(e) => {
        const tag = (e.target as HTMLElement).tagName.toLowerCase();
        if (tag === "input" || tag === "button" || tag === "select" || tag === "textarea") return;
        onRowClick(row);
      }}
    >
      {isTask && (
        <>
          <div ref={setBeforeRef} className="absolute top-0 inset-x-0 h-1/4 pointer-events-none z-10" aria-hidden />
          <div ref={setNestRef} className="absolute top-1/4 inset-x-0 h-1/2 pointer-events-none z-10" aria-hidden />
          <div ref={setAfterRef} className="absolute bottom-0 inset-x-0 h-1/4 pointer-events-none z-10" aria-hidden />
          {isOverBefore && !isDragging && <div className="absolute top-0 inset-x-1 h-0.5 bg-primary-500 rounded-full pointer-events-none z-20" aria-hidden />}
          {isOverAfter && !isDragging && <div className="absolute bottom-0 inset-x-1 h-0.5 bg-primary-500 rounded-full pointer-events-none z-20" aria-hidden />}
        </>
      )}

      <div role="cell" className="px-1 py-1 flex items-center gap-0.5">
        {isTask && row.task && (
          <>
            <SelectionCheckbox taskId={row.task.id} />
            <button {...attributes} {...listeners} type="button" className="opacity-0 group-hover/sel:opacity-100 cursor-grab active:cursor-grabbing text-ink-400 hover:text-ink-700 shrink-0" aria-label="גרור">
              <GripVertical className="w-3 h-3" />
            </button>
            <CompletionCircle taskId={row.task.id} completed={!!row.task.completed_at} onToggle={(next) => onComplete(row.task!.id, next)} />
          </>
        )}
      </div>

      <div role="cell" className="px-1 py-1 flex items-center justify-center">
        {isTask && wbsNumber && <span className="text-[10px] font-mono text-ink-400 select-none">{wbsNumber}</span>}
      </div>

      <div role="cell" className="px-2 py-1 flex items-center gap-2 min-w-0" style={{ paddingInlineStart: `${8 + row.depth * 16}px` }}>
        {isTask && row.task && row.hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCollapsed?.(row.task!.id); }}
            className="shrink-0 w-4 h-4 -ms-1 flex items-center justify-center text-[10px] text-ink-400 hover:text-ink-900 hover:bg-ink-150 rounded"
            title={collapsedIds?.has(row.task.id) ? "הרחב" : "כווץ"}
            aria-expanded={!collapsedIds?.has(row.task.id)}
          >
            {collapsedIds?.has(row.task.id) ? "◂" : "▾"}
          </button>
        ) : (
          <span className="shrink-0 w-4 h-4 -ms-1" aria-hidden />
        )}
        {isTask && row.task && !isPhase ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggleCritical?.(row.task!.id, !isCritical); }} className="w-1.5 h-1.5 rounded-full shrink-0 hover:scale-150 transition-transform" style={{ backgroundColor: isCritical ? "#ef4444" : "#d1d5db" }} title={isCritical ? "הסר מסלול קריטי" : "סמן כקריטי"} />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isEvent ? "#3b82f6" : isPhase ? row.accentColor ?? "#6b6b80" : "#d1d5db" }} />
        )}
        {isTask && row.task ? (
          <TitleCell task={row.task} onCommit={(next) => onUpdate(row.task!.id, { title: next }, "שינוי כותרת", { title: row.task!.title })} />
        ) : (
          <span className="truncate flex-1 min-w-0">{row.title}</span>
        )}
      </div>

      {cols.isVisible("description") && (
        <div role="cell" className="px-1 py-1 flex items-center min-w-0">
          {isTask && row.task && row.task.description && (
            <span className="text-[11px] text-ink-500 truncate">{stripHtml(row.task.description)}</span>
          )}
        </div>
      )}

      {cols.isVisible("notes") && (
        <div role="cell" className="px-1 py-1 flex items-center min-w-0">
          {isTask && row.task && (
            <NotesCellInline value={row.task.notes} onCommit={(next) => onUpdate(row.task!.id, { notes: next }, "עדכון הערות", { notes: row.task!.notes })} />
          )}
        </div>
      )}

      {multipleListsVisible && cols.isVisible("task_list") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && listName && <span className="text-[10px] text-ink-600 truncate max-w-full px-1 py-0.5 rounded bg-ink-100" title={listName}>{listName}</span>}
        </div>
      )}

      {cols.isVisible("urgency") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && <UrgencyMiniChip value={row.task.urgency} onChange={(v) => onUpdate(row.task!.id, { urgency: v }, "שינוי דחיפות", { urgency: row.task!.urgency })} />}
        </div>
      )}

      {cols.isVisible("status") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && <span className="text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100">{row.task.status}</span>}
        </div>
      )}

      {cols.isVisible("scheduled_at") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <DateOnlyCell value={row.task.scheduled_at} onCommit={(next) => onUpdate(row.task!.id, { scheduled_at: next }, "שינוי תאריך התחלה", { scheduled_at: row.task!.scheduled_at })} />
          )}
        </div>
      )}

      {cols.isVisible("end_date") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <EndDateCell task={row.task} onCommit={(patch) => onUpdate(row.task!.id, patch, "שינוי תאריך סיום", { duration_minutes: row.task!.duration_minutes, scheduled_at: row.task!.scheduled_at })} />
          )}
        </div>
      )}

      {cols.isVisible("deadline_at") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <DateOnlyCell value={row.task.deadline_at} onCommit={(next) => onUpdate(row.task!.id, { deadline_at: next }, "שינוי דד-ליין", { deadline_at: row.task!.deadline_at })} />
          )}
        </div>
      )}

      {cols.isVisible("duration_minutes") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <DurationDaysCell value={row.task.duration_minutes} onCommit={(next) => onUpdate(row.task!.id, { duration_minutes: next }, "שינוי משך", { duration_minutes: row.task!.duration_minutes })} />
          )}
        </div>
      )}

      {cols.isVisible("dependencies") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && onAddDep && (
            <DependenciesCell task={row.task} deps={taskDeps} visibleTaskMap={visibleTaskMap} onAdd={onAddDep} onRemove={onRemoveDep} onUpdate={onUpdateDep} />
          )}
        </div>
      )}

      {cols.isVisible("percent_complete") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && percentComplete !== undefined && <PercentCompleteCell pct={percentComplete} />}
        </div>
      )}

      {visibleCustomFields.map((cf) => (
        <div key={cf.id} role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <GanttCustomFieldCell field={cf} task={row.task} onSave={(value) => {
              const prev = (row.task!.custom_fields as Record<string, unknown> | null) ?? {};
              const next = { ...prev, [cf.id]: value };
              onUpdate(row.task!.id, { custom_fields: next as Task["custom_fields"] }, "עדכון שדה", { custom_fields: row.task!.custom_fields });
            }} />
          )}
        </div>
      ))}

      <div role="cell" />
    </div>
  );
}

function NotesCellInline({ value, onCommit }: { value: string | null; onCommit: (next: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        const next = trimmed || null;
        if (next !== (value ?? null)) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value ?? "");
      }}
      placeholder="הוסף הערה..."
      className="flex-1 min-w-0 w-full bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 focus:bg-white outline-none rounded-sm px-1 py-0.5 text-[11px] text-ink-700 placeholder:text-ink-300"
    />
  );
}

function TitleCell({ task, onCommit }: { task: Task; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(task.title);
  useEffect(() => setDraft(task.title), [task.title]);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { const t = draft.trim(); if (t && t !== task.title) onCommit(t); else setDraft(task.title); }}
      onKeyDown={(e) => { if (e.key === "Enter") ref.current?.blur(); if (e.key === "Escape") { setDraft(task.title); ref.current?.blur(); } }}
      className="flex-1 min-w-0 bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-primary-300 rounded-sm px-1 truncate"
    />
  );
}

function DateOnlyCell({ value, onCommit }: { value: string | null; onCommit: (next: string | null) => void }) {
  const toDateInput = (iso: string | null) => iso ? iso.slice(0, 10) : "";
  const [draft, setDraft] = useState(toDateInput(value));
  useEffect(() => setDraft(toDateInput(value)), [value]);
  return (
    <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (!draft) { if (value !== null) onCommit(null); return; }
        if (value && value.slice(0, 10) === draft) return;
        const nextISO = value ? draft + value.slice(10) : draft + "T00:00:00.000Z";
        if (nextISO !== value) onCommit(nextISO);
      }}
      className="text-[11px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full"
    />
  );
}

function EndDateCell({ task, onCommit }: { task: Task; onCommit: (patch: Partial<Pick<Task, "scheduled_at" | "duration_minutes">>) => void }) {
  const endDateStr = useMemo(() => {
    if (!task.scheduled_at || task.duration_minutes == null) return "";
    return new Date(new Date(task.scheduled_at).getTime() + task.duration_minutes * 60_000).toISOString().slice(0, 10);
  }, [task.scheduled_at, task.duration_minutes]);
  const [draft, setDraft] = useState(endDateStr);
  useEffect(() => setDraft(endDateStr), [endDateStr]);
  return (
    <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === endDateStr) return;
        if (!draft) { onCommit({ duration_minutes: null }); return; }
        const endDay = new Date(draft + "T00:00:00");
        if (task.scheduled_at) {
          const startDay = new Date(task.scheduled_at.slice(0, 10) + "T00:00:00");
          const daysDiff = Math.round((endDay.getTime() - startDay.getTime()) / (1440 * 60_000));
          const newDuration = Math.max(0, daysDiff * 1440);
          if (newDuration !== task.duration_minutes) onCommit({ duration_minutes: newDuration });
        } else if (task.duration_minutes != null && task.duration_minutes > 0) {
          onCommit({ scheduled_at: new Date(endDay.getTime() - task.duration_minutes * 60_000).toISOString() });
        }
      }}
      className="text-[11px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full"
    />
  );
}

function PercentCompleteCell({ pct }: { pct: number }) {
  const color = pct === 100 ? "#22c55e" : pct >= 50 ? "#3b82f6" : pct > 0 ? "#f59e0b" : "#d1d5db";
  return (
    <div className="flex flex-col items-center gap-0.5 w-full px-1">
      <span className="text-[10px] font-mono tabular-nums text-ink-700">{pct}%</span>
      <div className="w-full h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DurationDaysCell({ value, onCommit }: { value: number | null; onCommit: (next: number | null) => void }) {
  const toDays = (mins: number | null) =>
    mins == null ? "" : mins % 1440 === 0 ? String(mins / 1440) : (mins / 1440).toFixed(1);
  const [draft, setDraft] = useState(toDays(value));
  useEffect(() => setDraft(toDays(value)), [value]);
  return (
    <div className="flex items-center gap-0.5">
      <input type="number" min={0} step={0.5} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          const next = trimmed === "" ? null : Math.round(Number(trimmed) * 1440);
          if (next !== value && (next === null || !Number.isNaN(next))) onCommit(next);
        }}
        className="w-10 text-center text-[11px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5"
        title="משך בימים"
      />
      <span className="text-[10px] text-ink-400 select-none shrink-0">ד׳</span>
    </div>
  );
}

type DepRelation = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
const RELATION_LABELS: Record<DepRelation, string> = { finish_to_start: "FS", start_to_start: "SS", finish_to_finish: "FF", start_to_finish: "SF" };

function DepLagInput({ dep, onUpdate }: { dep: TaskDependency; onUpdate: (depId: string, patch: { lag_days?: number }) => void }) {
  const [draft, setDraft] = useState(String(dep.lag_days ?? 0));
  useEffect(() => setDraft(String(dep.lag_days ?? 0)), [dep.lag_days]);
  return (
    <input type="number" value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { const v = Number(draft); if (v !== (dep.lag_days ?? 0)) onUpdate(dep.id, { lag_days: v }); }}
      onClick={(e) => e.stopPropagation()}
      className="w-10 text-[10px] text-center border border-ink-200 rounded px-0.5 py-0 bg-white outline-none focus:border-primary-400 shrink-0"
      title="ימי פיגור (שלילי = קידום)"
    />
  );
}

function DependenciesCell({ task, deps, visibleTaskMap, onAdd, onRemove, onUpdate }: {
  task: Task;
  deps: TaskDependency[];
  visibleTaskMap: Map<string, GanttRow>;
  onAdd: (predecessorId: string, relation?: DepRelation, lagDays?: number) => void;
  onRemove: (depId: string) => void;
  onUpdate: (depId: string, patch: { relation?: DepRelation; lag_days?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const choices = useMemo(() => {
    const out: Array<{ id: string; title: string; isLinked: boolean; dep?: TaskDependency }> = [];
    for (const [id, row] of visibleTaskMap) {
      if (id === task.id) continue;
      const dep = deps.find((d) => d.depends_on_task_id === id);
      out.push({ id, title: row.title, isLinked: !!dep, dep });
    }
    out.sort((a, b) => { if (a.isLinked !== b.isLinked) return a.isLinked ? -1 : 1; return a.title.localeCompare(b.title, "he"); });
    return out;
  }, [visibleTaskMap, task.id, deps]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? choices.filter((c) => c.title.toLowerCase().includes(q)) : choices;
  }, [choices, filter]);

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-ink-100 text-[11px]", deps.length > 0 ? "text-ink-900 bg-ink-100" : "text-ink-400")}
        title={deps.length === 0 ? "אין תלויות" : `${deps.length} תלויות (לחצי לעריכה)`}
      >
        <Link2 className="w-3 h-3" />
        {deps.length > 0 && <span className="font-mono">{deps.length}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setFilter(""); }} />
          <div className="absolute end-0 mt-1 z-40 w-80 bg-white border border-ink-200 rounded-xl shadow-lift overflow-hidden">
            <div className="px-3 py-2 border-b border-ink-100 bg-ink-50/60">
              <div className="text-[11px] font-semibold text-ink-700 mb-1">תלויות</div>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="חיפוש משימה" autoFocus className="w-full text-xs bg-white border border-ink-200 rounded-md px-2 py-1 outline-none focus:border-primary-400" />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-ink-500 text-center">אין משימות תואמות</div>
              ) : filtered.map((c) => (
                <div key={c.id} className={cn("px-2 py-1 hover:bg-ink-50", c.isLinked && "bg-primary-50/40")}>
                  {c.isLinked && c.dep ? (
                    <div className="flex items-center gap-1">
                      <span className="flex-1 text-xs text-ink-900 truncate min-w-0">{c.title}</span>
                      <select value={c.dep.relation} onChange={(e) => onUpdate(c.dep!.id, { relation: e.target.value as DepRelation })} onClick={(e) => e.stopPropagation()} className="text-[10px] border border-ink-200 rounded px-0.5 py-0 bg-white outline-none focus:border-primary-400 shrink-0" title="סוג תלות">
                        {(Object.entries(RELATION_LABELS) as [DepRelation, string][]).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                      <span className="text-[10px] text-ink-400 shrink-0">פיגור:</span>
                      <DepLagInput dep={c.dep} onUpdate={onUpdate} />
                      <button type="button" onClick={() => onRemove(c.dep!.id)} className="p-0.5 rounded text-ink-400 hover:text-danger-500 shrink-0" title="הסר תלות">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { onAdd(c.id, "finish_to_start", 0); setOpen(false); setFilter(""); }} className="w-full text-start text-xs text-ink-700 truncate flex items-center gap-1">
                      <span className="text-ink-300">+</span>{c.title}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UrgencyMiniChip({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const filled = Math.min(3, Math.max(0, value));
  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-col items-center justify-center gap-[2px] px-1 py-1 rounded-md hover:bg-ink-100" title={`דחיפות ${filled}/3`}>
        {[3, 2, 1].map((n) => <span key={n} className={cn("h-[2px] w-3 rounded-sm transition-colors", n <= filled ? "bg-ink-900" : "bg-ink-200")} />)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-2 flex items-center gap-1">
            {[0, 1, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => { if (n !== value) onChange(n); setOpen(false); }} className={cn("flex flex-col items-center gap-1 p-1 rounded-md hover:bg-ink-100", n === filled && "bg-ink-100 ring-1 ring-ink-300")}>
                {n === 0 ? <span className="text-ink-400 text-xs h-[15px] flex items-center">∅</span> : <div className="flex flex-col items-center gap-[2px]">{[3, 2, 1].map((row) => <span key={row} className={cn("h-[2px] w-4 rounded-sm", row <= n ? "bg-ink-900" : "bg-ink-200")} />)}</div>}
                <span className="text-[9px] font-mono text-ink-500">{n}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ColumnHeader({ id: _id, label, onRename, align = "center" }: { id: string; label: string; onRename: (label: string) => void; align?: "start" | "center" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  useEffect(() => setDraft(label), [label]);
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== label) onRename(draft); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { if (draft !== label) onRename(draft); setEditing(false); } if (e.key === "Escape") { setDraft(label); setEditing(false); } }}
        className={cn("w-full bg-white border border-primary-400 rounded-sm px-1 py-0 text-[12px] outline-none", align === "start" ? "text-start" : "text-center")}
      />
    );
  }
  return (
    <button type="button" onDoubleClick={() => setEditing(true)} className={cn("block w-full hover:underline cursor-text", align === "start" ? "text-start" : "text-center")} title="לחיצה כפולה לשינוי השם">
      {label}
    </button>
  );
}

function SelectionCheckbox({ taskId }: { taskId: string }) {
  const isSelected = useIsTaskSelected(taskId);
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); const store = useTaskSelectionStore.getState(); if (e.shiftKey) { store.shiftSelect(taskId); } else { store.toggle(taskId); } }}
      aria-label={isSelected ? "בטל סימון" : "סמן משימה"} aria-pressed={isSelected}
      className={cn("shrink-0 w-3 h-3 rounded-[3px] border-2 flex items-center justify-center transition-all", isSelected ? "bg-primary-500 border-primary-500 text-white opacity-100" : "border-ink-300 hover:border-primary-500 opacity-0 group-hover/sel:opacity-100")}>
      {isSelected && <svg viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z" clipRule="evenodd" /></svg>}
    </button>
  );
}

function CompletionCircle({ taskId: _taskId, completed, onToggle }: { taskId: string; completed: boolean; onToggle: (completed: boolean) => void }) {
  const [pendingComplete, setPendingComplete] = useState(false);
  const pendingTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current); }, []);
  const showAsDone = completed || pendingComplete;
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingComplete && !completed) { if (pendingTimerRef.current) { window.clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; } setPendingComplete(false); return; }
    if (completed) { onToggle(false); return; }
    setPendingComplete(true);
    pendingTimerRef.current = window.setTimeout(() => { onToggle(true); pendingTimerRef.current = null; }, 500);
  };
  return (
    <button type="button" onClick={handleClick}
      className={cn("shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", showAsDone ? "bg-success-500 border-success-500 text-white" : "border-ink-300 hover:border-success-500")}
      aria-label={showAsDone ? "בטל השלמה" : "סמן כהושלמה"} aria-pressed={showAsDone} title={showAsDone ? "בטל השלמה" : "סמן כהושלמה"}>
      {showAsDone && <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z" clipRule="evenodd" /></svg>}
    </button>
  );
}

function GanttCustomFieldCell({ field, task, onSave }: { field: TaskCustomField; task: Task; onSave: (value: unknown) => void }) {
  const cf = (task.custom_fields as Record<string, unknown> | null) ?? {};
  const value = cf[field.id] ?? null;
  switch (field.field_type) {
    case "text": case "url": case "location": case "person":
      return <GanttCfTextCell value={(value as string) ?? ""} onSave={onSave} />;
    case "number": case "time":
      return <GanttCfNumberCell value={value as number | null} onSave={onSave} />;
    case "date":
      return <GanttCfDateCell value={(value as string) ?? ""} onSave={onSave} />;
    case "checkbox":
      return (
        <button type="button" onClick={() => onSave(!value)} className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", value ? "bg-primary-500 border-primary-500 text-white" : "border-ink-300")}>
          {value && <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z" clipRule="evenodd" /></svg>}
        </button>
      );
    case "stars": {
      const stars = Math.min(5, Math.max(0, (value as number) ?? 0));
      return <div className="flex gap-0.5">{[1,2,3,4,5].map((n) => <button key={n} type="button" onClick={() => onSave(n === stars ? 0 : n)} className={cn("text-[10px]", n <= stars ? "text-amber-400" : "text-ink-200")}>★</button>)}</div>;
    }
    case "select": {
      const opts = (field.options as Array<{ value: string; label: string }> | null) ?? [];
      return (
        <select value={(value as string) ?? ""} onChange={(e) => onSave(e.target.value || null)} className="text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full truncate">
          <option value="">—</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case "tag": {
      const tags = (value as string[]) ?? [];
      return <span className="text-[10px] text-ink-600 truncate">{tags.join(", ") || "—"}</span>;
    }
    default: return <span className="text-[10px] text-ink-300 truncate">—</span>;
  }
}

function GanttCfTextCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onSave(draft); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setDraft(value); }} className="text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full truncate" />;
}

function GanttCfNumberCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return <input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { const n = draft === "" ? null : Number(draft); if (n !== value && (n === null || !isNaN(n))) onSave(n); }} className="w-14 text-center text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5" />;
}

function GanttCfDateCell({ value, onSave }: { value: string; onSave: (v: string | null) => void }) {
  const toDateInput = (iso: string) => { if (!iso) return ""; try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; } };
  const [draft, setDraft] = useState(toDateInput(value));
  useEffect(() => setDraft(toDateInput(value)), [value]);
  return <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { const next = draft ? new Date(draft).toISOString() : null; if (next !== (value || null)) onSave(next); }} className="text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full" />;
}
