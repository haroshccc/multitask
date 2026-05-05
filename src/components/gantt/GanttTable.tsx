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
const HEADER_HEIGHT = 64; // matches GanttGrid timeline header

/** Build the CSS grid-template-columns string from the current column prefs. */
function buildGridTemplate(
  cols: ReturnType<typeof useGanttColumnPrefs>,
  visibleCustomFields: TaskCustomField[]
): string {
  const parts = ["80px", "minmax(200px,1fr)"];
  if (cols.isVisible("urgency")) parts.push("56px");
  if (cols.isVisible("status")) parts.push("96px");
  if (cols.isVisible("scheduled_at")) parts.push("144px");
  if (cols.isVisible("deadline_at")) parts.push("144px");
  if (cols.isVisible("duration_minutes")) parts.push("64px");
  if (cols.isVisible("dependencies")) parts.push("80px");
  for (let i = 0; i < visibleCustomFields.length; i++) parts.push("120px");
  parts.push("32px"); // settings icon column
  return parts.join(" ");
}

interface GanttTableProps {
  rows: GanttRow[];
  deps: TaskDependency[];
  criticalSet: Set<string>;
  onRowClick: (row: GanttRow) => void;
  layout: "side" | "stacked";
  onCreateTask?: (title: string) => Promise<void> | void;
  /** Custom fields of the currently-scoped project (only present when
   *  source.kind === "project"). Used to populate the custom field column
   *  section in the column manager and to render cells. */
  customFields?: TaskCustomField[];
}

/**
 * Editable Gantt table — CSS-grid-based (not a <table>) so each row can be
 * position:relative and host the three @dnd-kit droppable zones needed for
 * drag-to-reorder and drag-to-nest (above / into / below).
 *
 * Wave 9.2 — initial table.
 * Wave 14.C — converted <table> → CSS grid for drag-to-nest support.
 */
export function GanttTable({
  rows,
  deps,
  criticalSet,
  onRowClick,
  layout,
  onCreateTask,
  customFields = [],
}: GanttTableProps) {
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const createDep = useCreateTaskDependency();
  const deleteDep = useDeleteTaskDependency();
  const [newTitle, setNewTitle] = useState("");
  const cols = useGanttColumnPrefs();
  const [colMgrOpen, setColMgrOpen] = useState(false);
  const visibleCustomFields = useMemo(
    () => customFields.filter((cf) => cols.isVisible(cf.id)),
    [customFields, cols]
  );
  const gridTemplate = useMemo(
    () => buildGridTemplate(cols, visibleCustomFields),
    [cols, visibleCustomFields]
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
    for (const r of rows) {
      if (r.kind === "task" && r.task) m.set(r.task.id, r);
    }
    return m;
  }, [rows]);

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
    <div
      className={cn(
        "card overflow-hidden flex flex-col",
        layout === "stacked" && "max-h-[40vh]"
      )}
    >
      <div className="overflow-auto scrollbar-thin">
        <div role="table" className="w-full text-[12px] tabular-nums">
          {/* ── Sticky header ── */}
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
              <div
                role="columnheader"
                className="px-1 py-2"
                aria-label="פעולות שורה"
              />
              <div
                role="columnheader"
                className="text-start font-semibold text-ink-700 px-2 py-2 min-w-[200px]"
              >
                <ColumnHeader
                  id="title"
                  label={cols.getLabel("title", "משימה")}
                  onRename={(l) => cols.renameColumn("title", l)}
                  align="start"
                />
              </div>
              {cols.isVisible("urgency") && (
                <div
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id="urgency"
                    label={cols.getLabel("urgency", "דחיפות")}
                    onRename={(l) => cols.renameColumn("urgency", l)}
                  />
                </div>
              )}
              {cols.isVisible("status") && (
                <div
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id="status"
                    label={cols.getLabel("status", "סטטוס")}
                    onRename={(l) => cols.renameColumn("status", l)}
                  />
                </div>
              )}
              {cols.isVisible("scheduled_at") && (
                <div
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id="scheduled_at"
                    label={cols.getLabel("scheduled_at", "תזמון")}
                    onRename={(l) => cols.renameColumn("scheduled_at", l)}
                  />
                </div>
              )}
              {cols.isVisible("deadline_at") && (
                <div
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id="deadline_at"
                    label={cols.getLabel("deadline_at", "דד-ליין")}
                    onRename={(l) => cols.renameColumn("deadline_at", l)}
                  />
                </div>
              )}
              {cols.isVisible("duration_minutes") && (
                <div
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id="duration_minutes"
                    label={cols.getLabel("duration_minutes", "משך (ד׳)")}
                    onRename={(l) => cols.renameColumn("duration_minutes", l)}
                  />
                </div>
              )}
              {cols.isVisible("dependencies") && (
                <div
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id="dependencies"
                    label={cols.getLabel("dependencies", "תלויות")}
                    onRename={(l) => cols.renameColumn("dependencies", l)}
                  />
                </div>
              )}
              {/* Custom field column headers */}
              {visibleCustomFields.map((cf) => (
                <div
                  key={cf.id}
                  role="columnheader"
                  className="text-center font-semibold text-ink-700 px-1 py-2"
                >
                  <ColumnHeader
                    id={cf.id}
                    label={cols.getLabel(cf.id, cf.field_label)}
                    onRename={(l) => cols.renameColumn(cf.id, l)}
                  />
                </div>
              ))}

              {/* Column manager button */}
              <div
                role="columnheader"
                className="flex items-center justify-center px-0 py-0"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setColMgrOpen((v) => !v)}
                    className="p-1 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100"
                    title="ניהול עמודות"
                    aria-label="ניהול עמודות"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  {colMgrOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setColMgrOpen(false)}
                      />
                      <div className="absolute end-0 mt-1 z-40 w-56 bg-white border border-ink-200 rounded-xl shadow-lift py-1">
                        <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
                          עמודות גלויות
                        </div>
                        {GANTT_STANDARD_COLUMNS.filter(
                          (c) => !c.alwaysVisible
                        ).map((c) => {
                          const visible = cols.isVisible(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => cols.toggleVisible(c.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
                            >
                              <span
                                className={cn(
                                  "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                                  visible
                                    ? "bg-primary-500 border-primary-500"
                                    : "border-ink-300 bg-white"
                                )}
                              >
                                {visible && (
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="w-2 h-2 text-white"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </span>
                              <span className="flex-1 truncate">
                                {cols.getLabel(c.id, c.defaultLabel)}
                              </span>
                            </button>
                          );
                        })}
                        {/* Custom fields section — only shown when scoped
                            to a project that has custom fields. */}
                        {customFields.length > 0 && (
                          <>
                            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-t border-ink-100 mt-1">
                              שדות מותאמים אישית
                            </div>
                            {customFields.map((cf) => {
                              const visible = cols.isVisible(cf.id);
                              return (
                                <button
                                  key={cf.id}
                                  type="button"
                                  onClick={() => {
                                    if (visible) {
                                      cols.toggleVisible(cf.id);
                                    } else {
                                      cols.enableCustomField(cf.id);
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
                                >
                                  <span
                                    className={cn(
                                      "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                                      visible
                                        ? "bg-primary-500 border-primary-500"
                                        : "border-ink-300 bg-white"
                                    )}
                                  >
                                    {visible && (
                                      <svg
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="w-2 h-2 text-white"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="flex-1 truncate">
                                    {cols.getLabel(cf.id, cf.field_label)}
                                  </span>
                                </button>
                              );
                            })}
                          </>
                        )}
                        <div className="text-[10px] text-ink-400 px-3 py-1.5 border-t border-ink-100 mt-1">
                          לחיצה כפולה על כותרת עמודה לשינוי השם
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Body rows ── */}
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
                onComplete={(taskId, completed) =>
                  completeTask.mutate({ taskId, completed })
                }
                onAddDep={
                  r.kind === "task" && r.task
                    ? (predecessorId) =>
                        createDep.mutate({
                          taskId: r.task!.id,
                          dependsOnTaskId: predecessorId,
                        })
                    : undefined
                }
                onRemoveDep={(depId) => deleteDep.mutate(depId)}
              />
            ))}
          </div>

          {/* ── Inline new-task row ── */}
          {onCreateTask && (
            <div
              role="row"
              className="grid border-b border-ink-150 bg-primary-50/40 hover:bg-primary-50"
              style={{ gridTemplateColumns: gridTemplate, height: ROW_HEIGHT }}
            >
              {/* Spans all columns via the first cell taking full width */}
              <div
                role="cell"
                className="col-span-full px-4 flex items-center gap-2"
                style={{ gridColumn: "1 / -1" }}
              >
                <span className="text-primary-600 text-sm">+</span>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const trimmed = newTitle.trim();
                      if (!trimmed) return;
                      await onCreateTask(trimmed);
                      setNewTitle("");
                    }
                    if (e.key === "Escape") setNewTitle("");
                  }}
                  onBlur={async () => {
                    const trimmed = newTitle.trim();
                    if (!trimmed) return;
                    await onCreateTask(trimmed);
                    setNewTitle("");
                  }}
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

// ─── Body Row ────────────────────────────────────────────────────────────────

interface GanttTableBodyRowProps {
  row: GanttRow;
  gridTemplate: string;
  cols: ReturnType<typeof useGanttColumnPrefs>;
  criticalSet: Set<string>;
  taskDeps: TaskDependency[];
  visibleTaskMap: Map<string, GanttRow>;
  visibleCustomFields: TaskCustomField[];
  onRowClick: (row: GanttRow) => void;
  onUpdate: (
    taskId: string,
    patch: Partial<Task>,
    description: string,
    prev: Partial<Task>
  ) => void;
  onComplete: (taskId: string, completed: boolean) => void;
  onAddDep?: (predecessorId: string) => void;
  onRemoveDep: (depId: string) => void;
}

/**
 * Single Gantt table row — a CSS-grid div (not a <tr>) with position:relative
 * so the three @dnd-kit droppable zones can be absolutely positioned inside.
 *
 * Drop zones:
 *   before (top 25%)  → sibling above
 *   nest   (mid 50%)  → child of this task
 *   after  (bot 25%)  → sibling below
 */
function GanttTableBodyRow({
  row,
  gridTemplate,
  cols,
  criticalSet,
  taskDeps,
  visibleTaskMap,
  visibleCustomFields,
  onRowClick,
  onUpdate,
  onComplete,
  onAddDep,
  onRemoveDep,
}: GanttTableBodyRowProps) {
  const isTask = row.kind === "task" && !!row.task;
  const isCritical = isTask && criticalSet.has(row.task!.id);
  const isPhase = !!row.isPhase;
  const isEvent = row.kind === "event";
  const isUnscheduled = !!row.unscheduled;

  // ── Draggable ──
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `gantt-task:${row.id}`,
    data: {
      type: "gantt-task",
      taskId: row.task?.id,
      listId: row.task?.task_list_id ?? null,
      parentTaskId: row.task?.parent_task_id ?? null,
    },
    disabled: !isTask,
  });

  // ── Drop zones ──
  const { setNodeRef: setBeforeRef, isOver: isOverBefore } = useDroppable({
    id: `gantt-before:${row.id}`,
    data: {
      type: "gantt-task-before",
      taskId: row.task?.id,
      listId: row.task?.task_list_id ?? null,
      parentTaskId: row.task?.parent_task_id ?? null,
    },
    disabled: !isTask,
  });

  const { setNodeRef: setNestRef, isOver: isOverNest } = useDroppable({
    id: `gantt-nest:${row.id}`,
    data: {
      type: "gantt-task-nest",
      taskId: row.task?.id,
      listId: row.task?.task_list_id ?? null,
    },
    disabled: !isTask,
  });

  const { setNodeRef: setAfterRef, isOver: isOverAfter } = useDroppable({
    id: `gantt-after:${row.id}`,
    data: {
      type: "gantt-task-after",
      taskId: row.task?.id,
      listId: row.task?.task_list_id ?? null,
      parentTaskId: row.task?.parent_task_id ?? null,
    },
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
        ...(isPhase
          ? ({
              borderInlineStartWidth: 4,
              borderInlineStartColor: row.accentColor ?? "#6b6b80",
            } as React.CSSProperties)
          : {}),
      }}
    >
      {/* ── Drop zones (invisible strips, pointer-events:none) ── */}
      {isTask && (
        <>
          <div
            ref={setBeforeRef}
            className="absolute top-0 inset-x-0 h-1/4 pointer-events-none z-10"
            aria-hidden
          />
          <div
            ref={setNestRef}
            className="absolute top-1/4 inset-x-0 h-1/2 pointer-events-none z-10"
            aria-hidden
          />
          <div
            ref={setAfterRef}
            className="absolute bottom-0 inset-x-0 h-1/4 pointer-events-none z-10"
            aria-hidden
          />
          {isOverBefore && !isDragging && (
            <div
              className="absolute top-0 inset-x-1 h-0.5 bg-primary-500 rounded-full pointer-events-none z-20"
              aria-hidden
            />
          )}
          {isOverAfter && !isDragging && (
            <div
              className="absolute bottom-0 inset-x-1 h-0.5 bg-primary-500 rounded-full pointer-events-none z-20"
              aria-hidden
            />
          )}
        </>
      )}

      {/* ── Actions cell ── */}
      <div
        role="cell"
        className="px-1 py-1 flex items-center gap-0.5"
      >
        {isTask && row.task && (
          <>
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              type="button"
              className="opacity-0 group-hover/sel:opacity-100 cursor-grab active:cursor-grabbing text-ink-400 hover:text-ink-700 shrink-0"
              aria-label="גרור"
            >
              <GripVertical className="w-3 h-3" />
            </button>
            <SelectionCheckbox taskId={row.task.id} />
            <CompletionCircle
              taskId={row.task.id}
              completed={!!row.task.completed_at}
              accent={row.accentColor ?? "#6b6b80"}
              onToggle={(next) => onComplete(row.task!.id, next)}
            />
          </>
        )}
      </div>

      {/* ── Title cell ── */}
      <div
        role="cell"
        className="px-2 py-1 flex items-center gap-2 min-w-0"
        style={{ paddingInlineStart: `${8 + row.depth * 16}px` }}
      >
        <button
          type="button"
          onClick={() => onRowClick(row)}
          className="w-1.5 h-1.5 rounded-full shrink-0 hover:scale-150 transition-transform"
          style={{
            backgroundColor: isCritical
              ? "#ef4444"
              : isEvent
              ? "#3b82f6"
              : isPhase
              ? row.accentColor ?? "#6b6b80"
              : "#a8a8bc",
          }}
          title="פתח עריכה מלאה"
        />
        {isTask && row.task ? (
          <TitleCell
            task={row.task}
            onCommit={(next) =>
              onUpdate(row.task!.id, { title: next }, "שינוי כותרת", {
                title: row.task!.title,
              })
            }
          />
        ) : (
          <span className="truncate flex-1 min-w-0">{row.title}</span>
        )}
      </div>

      {/* ── Conditional cells ── */}
      {cols.isVisible("urgency") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <UrgencyMiniChip
              value={row.task.urgency}
              onChange={(v) =>
                onUpdate(
                  row.task!.id,
                  { urgency: v },
                  "שינוי דחיפות",
                  { urgency: row.task!.urgency }
                )
              }
            />
          )}
        </div>
      )}

      {cols.isVisible("status") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <span className="text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100">
              {row.task.status}
            </span>
          )}
        </div>
      )}

      {cols.isVisible("scheduled_at") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <DateTimeCell
              value={row.task.scheduled_at}
              onCommit={(next) =>
                onUpdate(
                  row.task!.id,
                  { scheduled_at: next },
                  "שינוי תזמון",
                  { scheduled_at: row.task!.scheduled_at }
                )
              }
            />
          )}
        </div>
      )}

      {cols.isVisible("deadline_at") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <DateTimeCell
              value={row.task.deadline_at}
              onCommit={(next) =>
                onUpdate(
                  row.task!.id,
                  { deadline_at: next },
                  "שינוי דד-ליין",
                  { deadline_at: row.task!.deadline_at }
                )
              }
            />
          )}
        </div>
      )}

      {cols.isVisible("duration_minutes") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && (
            <NumberCell
              value={row.task.duration_minutes}
              onCommit={(next) =>
                onUpdate(
                  row.task!.id,
                  { duration_minutes: next },
                  "שינוי משך",
                  { duration_minutes: row.task!.duration_minutes }
                )
              }
            />
          )}
        </div>
      )}

      {cols.isVisible("dependencies") && (
        <div role="cell" className="px-1 py-1 flex items-center justify-center">
          {isTask && row.task && onAddDep && (
            <DependenciesCell
              task={row.task}
              deps={taskDeps}
              visibleTaskMap={visibleTaskMap}
              onAdd={onAddDep}
              onRemove={onRemoveDep}
            />
          )}
        </div>
      )}

      {/* ── Custom field cells ── */}
      {visibleCustomFields.map((cf) => (
        <div
          key={cf.id}
          role="cell"
          className="px-1 py-1 flex items-center justify-center"
        >
          {isTask && row.task && (
            <GanttCustomFieldCell
              field={cf}
              task={row.task}
              onSave={(value) => {
                const prev =
                  (row.task!.custom_fields as Record<string, unknown> | null) ??
                  {};
                const next = { ...prev, [cf.id]: value };
                onUpdate(
                  row.task!.id,
                  { custom_fields: next as Task["custom_fields"] },
                  "עדכון שדה",
                  { custom_fields: row.task!.custom_fields }
                );
              }}
            />
          )}
        </div>
      ))}

      {/* Trailing cell — aligns with the column-manager header */}
      <div role="cell" />
    </div>
  );
}

// ─── Cell sub-components ─────────────────────────────────────────────────────

function TitleCell({
  task,
  onCommit,
}: {
  task: Task;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(task.title);
  useEffect(() => setDraft(task.title), [task.title]);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== task.title) onCommit(trimmed);
        else setDraft(task.title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") ref.current?.blur();
        if (e.key === "Escape") {
          setDraft(task.title);
          ref.current?.blur();
        }
      }}
      className="flex-1 min-w-0 bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-primary-300 rounded-sm px-1 truncate"
    />
  );
}

function DateTimeCell({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  const toLocalInput = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fromLocalInput = (s: string): string | null => {
    if (!s) return null;
    return new Date(s).toISOString();
  };

  const [draft, setDraft] = useState(toLocalInput(value));
  useEffect(() => setDraft(toLocalInput(value)), [value]);

  return (
    <input
      type="datetime-local"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = fromLocalInput(draft);
        if (next !== value) onCommit(next);
      }}
      className="text-[11px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full"
    />
  );
}

function NumberCell({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
}) {
  const [draft, setDraft] = useState<string>(
    value == null ? "" : String(value)
  );
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return (
    <input
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        const next = trimmed === "" ? null : Number(trimmed);
        if (next !== value && (next === null || !Number.isNaN(next))) {
          onCommit(next);
        }
      }}
      className="w-12 text-center text-[11px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5"
    />
  );
}

function DependenciesCell({
  task,
  deps,
  visibleTaskMap,
  onAdd,
  onRemove,
}: {
  task: Task;
  deps: TaskDependency[];
  visibleTaskMap: Map<string, GanttRow>;
  onAdd: (predecessorId: string) => void;
  onRemove: (depId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const choices = useMemo(() => {
    const out: Array<{
      id: string;
      title: string;
      isLinked: boolean;
      depId?: string;
    }> = [];
    for (const [id, row] of visibleTaskMap) {
      if (id === task.id) continue;
      const dep = deps.find((d) => d.depends_on_task_id === id);
      out.push({ id, title: row.title, isLinked: !!dep, depId: dep?.id });
    }
    out.sort((a, b) => {
      if (a.isLinked !== b.isLinked) return a.isLinked ? -1 : 1;
      return a.title.localeCompare(b.title, "he");
    });
    return out;
  }, [visibleTaskMap, task.id, deps]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter((c) => c.title.toLowerCase().includes(q));
  }, [choices, filter]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-ink-100 text-[11px]",
          deps.length > 0 ? "text-ink-900 bg-ink-100" : "text-ink-400"
        )}
        title={
          deps.length === 0
            ? "אין תלויות"
            : `${deps.length} תלויות (לחצי לעריכה)`
        }
      >
        <Link2 className="w-3 h-3" />
        {deps.length > 0 && (
          <span className="font-mono">{deps.length}</span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setOpen(false);
              setFilter("");
            }}
          />
          <div className="absolute end-0 mt-1 z-40 w-72 bg-white border border-ink-200 rounded-xl shadow-lift overflow-hidden">
            <div className="px-3 py-2 border-b border-ink-100 bg-ink-50/60">
              <div className="text-[11px] font-semibold text-ink-700 mb-1">
                תלוי ב…
              </div>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="חיפוש משימה"
                autoFocus
                className="w-full text-xs bg-white border border-ink-200 rounded-md px-2 py-1 outline-none focus:border-primary-400"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-ink-500 text-center">
                  אין משימות תואמות
                </div>
              ) : (
                filtered.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-ink-50 group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (c.isLinked && c.depId) {
                          onRemove(c.depId);
                        } else {
                          onAdd(c.id);
                        }
                      }}
                      className="flex-1 text-start text-xs text-ink-900 truncate"
                    >
                      <span
                        className={cn(
                          "inline-block w-3 h-3 rounded-sm border me-2 align-middle",
                          c.isLinked
                            ? "bg-primary-500 border-primary-500"
                            : "border-ink-300 bg-white"
                        )}
                      />
                      {c.title}
                    </button>
                    {c.isLinked && c.depId && (
                      <button
                        type="button"
                        onClick={() => onRemove(c.depId!)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-400 hover:text-danger-500"
                        title="הסר תלות"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UrgencyMiniChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = Math.min(3, Math.max(0, value));
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center justify-center gap-[2px] px-1 py-1 rounded-md hover:bg-ink-100"
        title={`דחיפות ${filled}/3`}
      >
        {[3, 2, 1].map((n) => (
          <span
            key={n}
            className={cn(
              "h-[2px] w-3 rounded-sm transition-colors",
              n <= filled ? "bg-ink-900" : "bg-ink-200"
            )}
          />
        ))}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-2 flex items-center gap-1">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (n !== value) onChange(n);
                  setOpen(false);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 p-1 rounded-md hover:bg-ink-100",
                  n === filled && "bg-ink-100 ring-1 ring-ink-300"
                )}
              >
                {n === 0 ? (
                  <span className="text-ink-400 text-xs h-[15px] flex items-center">
                    ∅
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-[2px]">
                    {[3, 2, 1].map((row) => (
                      <span
                        key={row}
                        className={cn(
                          "h-[2px] w-4 rounded-sm",
                          row <= n ? "bg-ink-900" : "bg-ink-200"
                        )}
                      />
                    ))}
                  </div>
                )}
                <span className="text-[9px] font-mono text-ink-500">{n}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ColumnHeader({
  id: _id,
  label,
  onRename,
  align = "center",
}: {
  id: string;
  label: string;
  onRename: (label: string) => void;
  align?: "start" | "center";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  useEffect(() => setDraft(label), [label]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== label) onRename(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft !== label) onRename(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(label);
            setEditing(false);
          }
        }}
        className={cn(
          "w-full bg-white border border-primary-400 rounded-sm px-1 py-0 text-[12px] outline-none",
          align === "start" ? "text-start" : "text-center"
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={() => setEditing(true)}
      className={cn(
        "block w-full hover:underline cursor-text",
        align === "start" ? "text-start" : "text-center"
      )}
      title="לחיצה כפולה לשינוי השם"
    >
      {label}
    </button>
  );
}

function SelectionCheckbox({ taskId }: { taskId: string }) {
  const isSelected = useIsTaskSelected(taskId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const store = useTaskSelectionStore.getState();
        if (e.shiftKey) {
          store.shiftSelect(taskId);
        } else {
          store.toggle(taskId);
        }
      }}
      aria-label={isSelected ? "בטל סימון" : "סמן משימה"}
      aria-pressed={isSelected}
      className={cn(
        "shrink-0 w-3.5 h-3.5 rounded-[3px] border-2 flex items-center justify-center transition-all",
        isSelected
          ? "bg-primary-500 border-primary-500 text-white opacity-100"
          : "border-ink-300 hover:border-primary-500 opacity-0 group-hover/sel:opacity-100"
      )}
    >
      {isSelected && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

function CompletionCircle({
  taskId: _taskId,
  completed,
  accent,
  onToggle,
}: {
  taskId: string;
  completed: boolean;
  accent: string;
  onToggle: (completed: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!completed);
      }}
      className={cn(
        "shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
        completed
          ? "text-white border-transparent"
          : "border-ink-300 hover:border-ink-500"
      )}
      style={
        completed
          ? { backgroundColor: accent, borderColor: accent }
          : undefined
      }
      aria-label={completed ? "בטל השלמה" : "סמן כהושלמה"}
      aria-pressed={completed}
      title={completed ? "בטל השלמה" : "סמן כהושלמה"}
    >
      {completed && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

/** Compact custom field cell for the Gantt table. Supports the common field
 *  types inline; complex types (file, multiselect) are read-only badges. */
function GanttCustomFieldCell({
  field,
  task,
  onSave,
}: {
  field: TaskCustomField;
  task: Task;
  onSave: (value: unknown) => void;
}) {
  const cf = (task.custom_fields as Record<string, unknown> | null) ?? {};
  const value = cf[field.id] ?? null;

  switch (field.field_type) {
    case "text":
    case "url":
    case "location":
    case "person":
      return (
        <GanttCfTextCell
          value={(value as string) ?? ""}
          onSave={onSave}
        />
      );
    case "number":
    case "time":
      return (
        <GanttCfNumberCell
          value={value as number | null}
          onSave={onSave}
        />
      );
    case "date":
      return (
        <GanttCfDateCell value={(value as string) ?? ""} onSave={onSave} />
      );
    case "checkbox":
      return (
        <button
          type="button"
          onClick={() => onSave(!value)}
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            value ? "bg-primary-500 border-primary-500 text-white" : "border-ink-300"
          )}
        >
          {value && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      );
    case "stars": {
      const stars = Math.min(5, Math.max(0, (value as number) ?? 0));
      return (
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSave(n === stars ? 0 : n)}
              className={cn(
                "text-[10px]",
                n <= stars ? "text-amber-400" : "text-ink-200"
              )}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case "select": {
      const opts = (field.options as Array<{ value: string; label: string }> | null) ?? [];
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onSave(e.target.value || null)}
          className="text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full truncate"
        >
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "tag": {
      const tags = (value as string[]) ?? [];
      return (
        <span className="text-[10px] text-ink-600 truncate">
          {tags.join(", ") || "—"}
        </span>
      );
    }
    default:
      return (
        <span className="text-[10px] text-ink-300 truncate">—</span>
      );
  }
}

function GanttCfTextCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className="text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full truncate"
    />
  );
}

function GanttCfNumberCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = draft === "" ? null : Number(draft);
        if (n !== value && (n === null || !isNaN(n))) onSave(n);
      }}
      className="w-14 text-center text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5"
    />
  );
}

function GanttCfDateCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  const toDateInput = (iso: string): string => {
    if (!iso) return "";
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };
  const [draft, setDraft] = useState(toDateInput(value));
  useEffect(() => setDraft(toDateInput(value)), [value]);
  return (
    <input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft ? new Date(draft).toISOString() : null;
        if (next !== (value || null)) onSave(next);
      }}
      className="text-[10px] bg-transparent border border-transparent hover:border-ink-200 focus:border-primary-400 outline-none rounded-sm px-1 py-0.5 w-full"
    />
  );
}

