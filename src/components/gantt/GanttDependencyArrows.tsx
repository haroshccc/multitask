import { useMemo } from "react";
import type { TaskDependency } from "@/lib/types/domain";
import { DAY_MS, type GanttRow } from "./gantt-utils";

interface GanttDependencyArrowsProps {
  rows: GanttRow[];
  deps: TaskDependency[];
  pxPerDay: number;
  origin: Date;
  rowHeight: number;
  totalWidth: number;
  totalHeight: number;
  criticalSet: Set<string>;
  /** RTL flips the X axis in the timeline container. */
  isRtl: boolean;
}

/**
 * SVG arrows connecting dependency endpoints.
 *
 * We only draw `finish_to_start` explicitly (the common case) but handle the
 * other three relation types at the level of endpoint choice — the arrow goes
 * from whichever end of the predecessor the relation specifies, to whichever
 * end of the successor. The path itself is a "right-angle bend" pattern
 * common to Gantt tools.
 */
export function GanttDependencyArrows({
  rows,
  deps,
  pxPerDay,
  origin,
  rowHeight,
  totalWidth,
  totalHeight,
  criticalSet,
  isRtl,
}: GanttDependencyArrowsProps) {
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.task.id, i));
    return m;
  }, [rows]);
  const rowById = useMemo(() => {
    const m = new Map<string, GanttRow>();
    for (const r of rows) m.set(r.task.id, r);
    return m;
  }, [rows]);

  const dayToPx = (d: Date): number => {
    const days = (d.getTime() - origin.getTime()) / DAY_MS;
    return days * pxPerDay;
  };

  // Convert a "logical start" X (days from origin) to the SVG X coordinate.
  // In RTL, the visual X = totalWidth - logicalX.
  const toSvgX = (logicalPx: number): number =>
    isRtl ? totalWidth - logicalPx : logicalPx;

  const paths: { d: string; critical: boolean; key: string }[] = [];

  for (const dep of deps) {
    const fromRow = rowById.get(dep.depends_on_task_id);
    const toRow = rowById.get(dep.task_id);
    if (!fromRow || !toRow) continue;
    const fromIdx = rowIndex.get(fromRow.task.id);
    const toIdx = rowIndex.get(toRow.task.id);
    if (fromIdx == null || toIdx == null) continue;

    // Endpoint pixel positions (logical days from origin).
    const fromEnd = dep.relation === "start_to_start" || dep.relation === "start_to_finish"
      ? fromRow.start
      : fromRow.end;
    const toStart = dep.relation === "start_to_finish" || dep.relation === "finish_to_finish"
      ? toRow.end
      : toRow.start;

    const fromXLogical = dayToPx(fromEnd);
    const toXLogical = dayToPx(toStart);
    const fromY = fromIdx * rowHeight + rowHeight / 2;
    const toY = toIdx * rowHeight + rowHeight / 2;

    const fromX = toSvgX(fromXLogical);
    const toX = toSvgX(toXLogical);

    // Right-angle path: go out of predecessor end, step over, drop/climb, in.
    const GAP = 10;
    // In LTR, "forward" means x increases; in RTL, x decreases.
    const outboundDir = isRtl ? -1 : 1;
    const inboundDir = isRtl ? -1 : 1;
    const midX = (fromX + toX) / 2;

    const d = [
      `M ${fromX} ${fromY}`,
      `L ${fromX + outboundDir * GAP} ${fromY}`,
      `L ${midX} ${fromY}`,
      `L ${midX} ${toY}`,
      `L ${toX - inboundDir * GAP} ${toY}`,
      `L ${toX} ${toY}`,
    ].join(" ");

    const critical =
      criticalSet.has(fromRow.task.id) && criticalSet.has(toRow.task.id);

    paths.push({ d, critical, key: dep.id });
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
    >
      <defs>
        <marker
          id="arrow-normal"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient={isRtl ? "auto-start-reverse" : "auto"}
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#6b6b80" />
        </marker>
        <marker
          id="arrow-critical"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient={isRtl ? "auto-start-reverse" : "auto"}
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#ef4444" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.critical ? "#ef4444" : "#a8a8bc"}
          strokeWidth={p.critical ? 2 : 1.5}
          strokeDasharray={p.critical ? undefined : "4 3"}
          markerEnd={`url(#${p.critical ? "arrow-critical" : "arrow-normal"})`}
        />
      ))}
    </svg>
  );
}
