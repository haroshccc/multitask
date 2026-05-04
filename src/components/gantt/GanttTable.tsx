import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCreateTaskDependency,
  useDeleteTaskDependency,
  useUpdateTask,
} from "@/lib/hooks/useTasks";
import {
  GANTT_STANDARD_COLUMNS,
  useGanttColumnPrefs,
} from "@/lib/hooks/useGanttColumnPrefs";
import { pushUndo } from "@/lib/undo/store";
import type { Task, TaskDependency } from "@/lib/types/domain";
import type { GanttRow } from "./gantt-utils";

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 64; // matches GanttGrid timeline header

interface GanttTableProps {
  rows: GanttRow[];
  /** Every dependency in the org — used by the dependencies cell to look
   *  up which tasks each row depends on. */
  deps: TaskDependency[];
  /** Critical-path rows get a warm tint, mirroring the grid. */
  criticalSet: Set<string>;
  /** Click on a row → open the full edit modal (same handler as the bar). */
  onRowClick: (row: GanttRow) => void;
  /** When `stacked`, the table claims a viewport-bounded height with its own
   *  vertical scroll so the Gantt below stays in view. When `side`, the
   *  table grows to fit the rows (the surrounding flex handles overflow). */
  layout: "side" | "stacked";
  /** Add a task with the given title to the current scope. When provided
   *  the table renders an inline + new row at the bottom; omitted when
   *  the scope is "all" because there's no obvious destination list. */
  onCreateTask?: (title: string) => Promise<void> | void;
}

/**
 * Editable Gantt table — the left/top "MS Project" pane that shows every row
 * with its key fields exposed for inline edit. Vertically aligned with the
 * Gantt timeline (same row height + header height) so a row in the table
 * lines up with its bar in the grid.
 *
 * Wave 9.2 — initial column set: title, urgency (3-bar chip), status,
 * scheduled_at, deadline_at, duration_minutes. All edits go through
 * `useUpdateTask` and are wrapped in `pushUndo`. Phase rows render with a
 * leading colored stripe, bold font, and a subtle background — mirroring
 * the existing Gantt sidebar treatment so the visual identity carries
 * through.
 */
export function GanttTable({
  rows,
  deps,
  criticalSet,
  onRowClick,
  layout,
  onCreateTask,
}: GanttTableProps) {
  const updateTask = useUpdateTask();
  const createDep = useCreateTaskDependency();
  const deleteDep = useDeleteTaskDependency();
  const [newTitle, setNewTitle] = useState("");
  const cols = useGanttColumnPrefs();
  const [colMgrOpen, setColMgrOpen] = useState(false);

  // Index dependencies by task — for each task id, the list of tasks it
  // depends on (i.e. predecessors that must finish first).
  const depsByTask = useMemo(() => {
    const m = new Map<string, TaskDependency[]>();
    for (const d of deps) {
      const arr = m.get(d.task_id) ?? [];
      arr.push(d);
      m.set(d.task_id, arr);
    }
    return m;
  }, [deps]);

  // All visible task rows — used by the dependency picker to limit choices
  // to what's currently on the Gantt (cross-list deps require a wider scope
  // and are rare; deferred).
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
        <table className="w-full text-[12px] tabular-nums border-collapse">
          <thead
            className="sticky top-0 z-10 bg-ink-50/95 backdrop-blur-sm"
            style={{ height: HEADER_HEIGHT }}
          >
            <tr className="border-b border-ink-200">
              <th className="text-start font-semibold text-ink-700 px-2 py-2 min-w-[200px]">
                <ColumnHeader
                  id="title"
                  label={cols.getLabel("title", "משימה")}
                  onRename={(label) => cols.renameColumn("title", label)}
                  align="start"
                />
              </th>
              {cols.isVisible("urgency") && (
                <th className="text-center font-semibold text-ink-700 px-1 py-2 w-14">
                  <ColumnHeader
                    id="urgency"
                    label={cols.getLabel("urgency", "דחיפות")}
                    onRename={(label) => cols.renameColumn("urgency", label)}
                  />
                </th>
              )}
              {cols.isVisible("status") && (
                <th className="text-center font-semibold text-ink-700 px-1 py-2 w-24">
                  <ColumnHeader
                    id="status"
                    label={cols.getLabel("status", "סטטוס")}
                    onRename={(label) => cols.renameColumn("status", label)}
                  />
                </th>
              )}
              {cols.isVisible("scheduled_at") && (
                <th className="text-center font-semibold text-ink-700 px-1 py-2 w-36">
                  <ColumnHeader
                    id="scheduled_at"
                    label={cols.getLabel("scheduled_at", "תזמון")}
                    onRename={(label) => cols.renameColumn("scheduled_at", label)}
                  />
                </th>
              )}
              {cols.isVisible("deadline_at") && (
                <th className="text-center font-semibold text-ink-700 px-1 py-2 w-36">
                  <ColumnHeader
                    id="deadline_at"
                    label={cols.getLabel("deadline_at", "דד-ליין")}
                    onRename={(label) => cols.renameColumn("deadline_at", label)}
                  />
                </th>
              )}
              {cols.isVisible("duration_minutes") && (
                <th className="text-center font-semibold text-ink-700 px-1 py-2 w-16">
                  <ColumnHeader
                    id="duration_minutes"
                    label={cols.getLabel("duration_minutes", "משך (ד׳)")}
                    onRename={(label) =>
                      cols.renameColumn("duration_minutes", label)
                    }
                  />
                </th>
              )}
              {cols.isVisible("dependencies") && (
                <th className="text-center font-semibold text-ink-700 px-1 py-2 w-20">
                  <ColumnHeader
                    id="dependencies"
                    label={cols.getLabel("dependencies", "תלויות")}
                    onRename={(label) =>
                      cols.renameColumn("dependencies", label)
                    }
                  />
                </th>
              )}
              {/* Column manager — opens a popover with show/hide toggles for
                  every standard column. The "title" column is always visible
                  so it doesn't appear in the toggle list. */}
              <th className="w-8 px-0 py-0 align-middle">
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
                        <div className="text-[10px] text-ink-400 px-3 py-1.5 border-t border-ink-100 mt-1">
                          לחיצה כפולה על כותרת עמודה לשינוי השם
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isCritical =
                r.kind === "task" && !!r.task && criticalSet.has(r.task.id);
              const isPhase = !!r.isPhase;
              const isEvent = r.kind === "event";
              const isUnscheduled = !!r.unscheduled;
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-ink-150 hover:bg-ink-100",
                    // Scheduled = light background (white). Unscheduled =
                    // distinctly darker tint so the eye picks them out as
                    // "needs attention". Phases keep their own subtle tint;
                    // critical-path rows tinted warm red.
                    isUnscheduled ? "bg-ink-100" : "bg-white",
                    r.completed && "opacity-60",
                    isCritical && "bg-danger-500/5",
                    isPhase && !isUnscheduled && "bg-ink-50/60 font-semibold",
                    isPhase && isUnscheduled && "font-semibold"
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    ...(isPhase
                      ? ({
                          borderInlineStartWidth: 4,
                          borderInlineStartColor: r.accentColor ?? "#6b6b80",
                        } as React.CSSProperties)
                      : {}),
                  }}
                >
                  {/* Title — clickable to open full edit modal. The text
                      itself is also editable inline (commits on blur). */}
                  <td className="px-2 py-1">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingInlineStart: r.depth * 16 }}
                    >
                      <button
                        type="button"
                        onClick={() => onRowClick(r)}
                        className="w-1.5 h-1.5 rounded-full shrink-0 hover:scale-150 transition-transform"
                        style={{
                          backgroundColor: isCritical
                            ? "#ef4444"
                            : isEvent
                            ? "#3b82f6"
                            : isPhase
                            ? r.accentColor ?? "#6b6b80"
                            : "#a8a8bc",
                        }}
                        title="פתח עריכה מלאה"
                      />
                      {r.kind === "task" && r.task ? (
                        <TitleCell
                          task={r.task}
                          onCommit={(next) => {
                            const prev = { title: r.task!.title };
                            update(
                              r.task!.id,
                              { title: next },
                              "שינוי כותרת",
                              prev
                            );
                          }}
                        />
                      ) : (
                        <span className="truncate flex-1 min-w-0">
                          {r.title}
                        </span>
                      )}
                    </div>
                  </td>

                  {cols.isVisible("urgency") && (
                    <td className="px-1 py-1 text-center">
                      {r.kind === "task" && r.task && (
                        <UrgencyMiniChip
                          value={r.task.urgency}
                          onChange={(v) =>
                            update(
                              r.task!.id,
                              { urgency: v },
                              "שינוי דחיפות",
                              { urgency: r.task!.urgency }
                            )
                          }
                        />
                      )}
                    </td>
                  )}

                  {cols.isVisible("status") && (
                    <td className="px-1 py-1 text-center">
                      {r.kind === "task" && r.task && (
                        <span className="text-[10px] text-ink-600 px-1.5 py-0.5 rounded-md bg-ink-100">
                          {r.task.status}
                        </span>
                      )}
                    </td>
                  )}

                  {cols.isVisible("scheduled_at") && (
                    <td className="px-1 py-1 text-center">
                      {r.kind === "task" && r.task && (
                        <DateTimeCell
                          value={r.task.scheduled_at}
                          onCommit={(next) => {
                            update(
                              r.task!.id,
                              { scheduled_at: next },
                              "שינוי תזמון",
                              { scheduled_at: r.task!.scheduled_at }
                            );
                          }}
                        />
                      )}
                    </td>
                  )}

                  {cols.isVisible("deadline_at") && (
                    <td className="px-1 py-1 text-center">
                      {r.kind === "task" && r.task && (
                        <DateTimeCell
                          value={r.task.deadline_at}
                          onCommit={(next) => {
                            update(
                              r.task!.id,
                              { deadline_at: next },
                              "שינוי דד-ליין",
                              { deadline_at: r.task!.deadline_at }
                            );
                          }}
                        />
                      )}
                    </td>
                  )}

                  {cols.isVisible("duration_minutes") && (
                    <td className="px-1 py-1 text-center">
                      {r.kind === "task" && r.task && (
                        <NumberCell
                          value={r.task.duration_minutes}
                          onCommit={(next) => {
                            update(
                              r.task!.id,
                              { duration_minutes: next },
                              "שינוי משך",
                              { duration_minutes: r.task!.duration_minutes }
                            );
                          }}
                        />
                      )}
                    </td>
                  )}

                  {cols.isVisible("dependencies") && (
                    <td className="px-1 py-1 text-center">
                      {r.kind === "task" && r.task && (
                        <DependenciesCell
                          task={r.task}
                          deps={depsByTask.get(r.task.id) ?? []}
                          visibleTaskMap={visibleTaskMap}
                          onAdd={(predecessorId) => {
                            createDep.mutate({
                              taskId: r.task!.id,
                              dependsOnTaskId: predecessorId,
                            });
                          }}
                          onRemove={(depId) => {
                            deleteDep.mutate(depId);
                          }}
                        />
                      )}
                    </td>
                  )}
                  {/* Trailing cell to align with the column-manager header. */}
                  <td className="w-8" />
                </tr>
              );
            })}
            {/* Inline + new task row — only shown when the scope picks a
                concrete destination (a list or a project). With "all"
                selected we don't know which list a new task should land
                in, so the affordance is suppressed. Enter or blur commits;
                the input clears so the user can keep typing rows. */}
            {onCreateTask && (
              <tr
                className="border-b border-ink-150 bg-primary-50/40 hover:bg-primary-50"
                style={{ height: ROW_HEIGHT }}
              >
                <td className="px-2 py-1" colSpan={8}>
                  <div className="flex items-center gap-2">
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
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Cell components — kept inline so the table file stays self-contained;
// they're tiny and only meaningful in this context. Each commits on blur or
// Enter, reverts on Escape, and stays in sync with the underlying task when
// realtime updates push new values in.

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
  // datetime-local needs YYYY-MM-DDTHH:mm in local time, not ISO/UTC.
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
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
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

  // Choices: every visible task except this one. Linked predecessors are
  // surfaced first so the most-relevant rows are at the top.
  const choices = useMemo(() => {
    const out: Array<{ id: string; title: string; isLinked: boolean; depId?: string }> = [];
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
        {deps.length > 0 && <span className="font-mono">{deps.length}</span>}
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

/**
 * Column header — renders the label, supports double-click to rename
 * inline (commits on Enter or blur, reverts on Escape). The default
 * label is restored if the user clears the input.
 */
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
