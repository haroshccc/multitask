/**
 * Gantt → Excel export.
 *
 * Generates a styled HTML table saved with the .xls extension and the
 * "application/vnd.ms-excel" MIME type. Excel opens this natively as a
 * worksheet — cell background colors render as Gantt bars, frozen panes
 * keep the task-metadata columns visible while scrolling the timeline,
 * and the user can resize/sort/filter as in any sheet.
 *
 * Trade-off: this produces a 2003-era "Excel HTML" file rather than a
 * modern .xlsx zip. Pros: zero runtime dependencies (no xlsx/exceljs in
 * the bundle), instant export. Cons: Excel shows a "format doesn't
 * match" notice on first open. Acceptable for a v1.
 */
import type { GanttRow } from "./gantt-utils";
import { DAY_MS, startOfDay } from "./gantt-utils";

export type ExcelGranularity = "day" | "week" | "month";

interface ExportOptions {
  rows: GanttRow[];
  from: Date;
  to: Date;
  granularity: ExcelGranularity;
  /** Optional title used for the sheet name + filename. */
  title?: string;
  /** Optional list-id → list-name map for the "Resource / list" column. */
  listNames?: Map<string, string>;
  /** Optional user-id → user-name map for the assignee column. */
  memberNames?: Map<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "לעשות",
  in_progress: "בעבודה",
  pending_approval: "ממתין לאישור",
  done: "בוצע",
};

const URGENCY_LABELS: Record<number, string> = {
  0: "—",
  1: "נמוכה",
  2: "בינונית",
  3: "גבוהה",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function isoWeek(d: Date): number {
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / DAY_MS);
  return Math.ceil((days + jan1.getDay() + 1) / 7);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

/** Generate timeline column dates between `from` and `to` at the given
 *  granularity (one column = 1 day / 1 week / 1 month). */
function generateColumns(from: Date, to: Date, granularity: ExcelGranularity): Date[] {
  const cols: Date[] = [];
  let cursor = startOfDay(from);
  if (granularity === "week") {
    cursor.setDate(cursor.getDate() - cursor.getDay());
  } else if (granularity === "month") {
    cursor.setDate(1);
  }
  while (cursor <= to) {
    cols.push(new Date(cursor));
    if (granularity === "day") {
      cursor.setDate(cursor.getDate() + 1);
    } else if (granularity === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return cols;
}

/** Column header label (e.g. "ש20 17/3" for week, "15/3" for day, "מרץ 2026" for month). */
function colHeaderLabel(d: Date, granularity: ExcelGranularity): string {
  if (granularity === "day") return `${d.getDate()}/${d.getMonth() + 1}`;
  if (granularity === "week") return `ש${isoWeek(d)}<br/><span style="font-weight:400;font-size:9pt">${d.getDate()}/${d.getMonth() + 1}</span>`;
  return d.toLocaleDateString("he-IL", { month: "short", year: "numeric" });
}

/** End date of a column (exclusive). */
function colEnd(d: Date, granularity: ExcelGranularity): Date {
  const x = new Date(d);
  if (granularity === "day") x.setDate(x.getDate() + 1);
  else if (granularity === "week") x.setDate(x.getDate() + 7);
  else x.setMonth(x.getMonth() + 1);
  return x;
}

/** Pick a bar color for a row based on its accent / state. */
function barColor(row: GanttRow): string {
  if (row.completed) return "#d1fae5"; // green-100
  if (row.kind === "event") return "#ddd6fe"; // violet-200
  if (row.isPhase) return row.accentColor ?? "#cbd5e1"; // slate-300
  return "#bfdbfe"; // blue-200
}

/** Border color (slightly darker than the fill for visual separation). */
function barBorderColor(row: GanttRow): string {
  if (row.completed) return "#10b981";
  if (row.kind === "event") return "#8b5cf6";
  if (row.isPhase) return row.accentColor ?? "#64748b";
  return "#3b82f6";
}

export function buildGanttExcelHtml(opts: ExportOptions): string {
  const { rows, from, to, granularity, listNames, memberNames } = opts;
  const cols = generateColumns(from, to, granularity);
  const colWidth = granularity === "day" ? 28 : granularity === "week" ? 60 : 90;

  // Header row 1: metadata column titles + timeline title spanning all date columns.
  const metaHeaders = [
    "#",
    "משימה",
    "סטטוס",
    "דחיפות",
    "רשימה",
    "אחראי",
    "התחלה",
    "סיום",
    "משך (ימים)",
    "% הושלם",
  ];

  let html = "";
  html += '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += "<head><meta charset=\"UTF-8\"/>";
  html += "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>";
  html += `<x:Name>${escapeHtml((opts.title ?? "Gantt").slice(0, 31))}</x:Name>`;
  html += "<x:WorksheetOptions><x:DisplayRightToLeft/><x:FreezePanes/><x:FrozenNoSplit/>";
  html += `<x:SplitHorizontal>2</x:SplitHorizontal><x:TopRowBottomPane>2</x:TopRowBottomPane>`;
  html += `<x:SplitVertical>${metaHeaders.length}</x:SplitVertical><x:LeftColumnRightPane>${metaHeaders.length}</x:LeftColumnRightPane>`;
  html += "<x:ActivePane>0</x:ActivePane></x:WorksheetOptions>";
  html += "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->";
  html += `<style>
    table { border-collapse: collapse; font-family: "Arial", sans-serif; font-size: 10pt; direction: rtl; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; }
    th { background: #1f2937; color: white; font-weight: 600; text-align: center; }
    th.meta { background: #374151; min-width: 60px; }
    .num { mso-number-format: '0'; text-align: center; }
    .pct { mso-number-format: '0\\%'; text-align: center; }
    .date { mso-number-format: 'dd/mm/yyyy'; text-align: center; font-size: 9pt; }
    .row-phase { background: #f8fafc; font-weight: 700; }
    .row-done { color: #6b7280; }
    .timeline-cell { padding: 0; min-width: ${colWidth}px; max-width: ${colWidth}px; }
    .bar { background: #bfdbfe; }
    .bar-mid { background: #3b82f6; }
    .group-header { background: #475569; color: white; text-align: center; font-size: 9pt; }
  </style></head><body>`;

  html += "<table>";

  // Group header — for week/day granularity, add a row showing the month spanning multiple cols.
  if (granularity === "day" || granularity === "week") {
    html += "<tr>";
    for (const _h of metaHeaders) html += `<th class="meta">&nbsp;</th>`;
    let i = 0;
    while (i < cols.length) {
      const c = cols[i]!;
      const monthLabel = c.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
      let span = 1;
      while (
        i + span < cols.length &&
        cols[i + span]!.getMonth() === c.getMonth() &&
        cols[i + span]!.getFullYear() === c.getFullYear()
      ) {
        span += 1;
      }
      html += `<th colspan="${span}" class="group-header">${escapeHtml(monthLabel)}</th>`;
      i += span;
    }
    html += "</tr>";
  }

  // Main header row
  html += "<tr>";
  for (const h of metaHeaders) html += `<th class="meta">${escapeHtml(h)}</th>`;
  for (const c of cols) html += `<th>${colHeaderLabel(c, granularity)}</th>`;
  html += "</tr>";

  // Data rows
  rows.forEach((row, idx) => {
    if (row.unscheduled) return; // skip unscheduled tasks — they have no bar
    const task = row.task;
    const event = row.event;
    const statusLabel = task ? STATUS_LABELS[task.status] ?? task.status : event ? "אירוע" : "—";
    const urgency = task ? URGENCY_LABELS[task.urgency] ?? "—" : "—";
    const listName = task?.task_list_id ? listNames?.get(task.task_list_id) ?? "" : "";
    const assignee = task?.assignee_user_id ? memberNames?.get(task.assignee_user_id) ?? "" : "";
    const start = row.start;
    const end = row.end;
    const durationDays = Math.max(0.5, Math.round(((end.getTime() - start.getTime()) / DAY_MS) * 10) / 10);
    const pct =
      task?.completed_at
        ? 100
        : (task as any)?.percent_complete != null
        ? Math.round(((task as any).percent_complete as number) * 100) / 100
        : 0;

    const rowClass = row.isPhase ? "row-phase" : row.completed ? "row-done" : "";
    const indent = "&nbsp;".repeat(Math.max(0, row.depth * 4));
    html += `<tr class="${rowClass}">`;
    html += `<td class="num">${idx + 1}</td>`;
    html += `<td>${indent}${escapeHtml(row.title)}</td>`;
    html += `<td>${escapeHtml(statusLabel)}</td>`;
    html += `<td>${escapeHtml(urgency)}</td>`;
    html += `<td>${escapeHtml(listName)}</td>`;
    html += `<td>${escapeHtml(assignee)}</td>`;
    html += `<td class="date">${fmtDate(start)}</td>`;
    html += `<td class="date">${fmtDate(end)}</td>`;
    html += `<td class="num">${durationDays}</td>`;
    html += `<td class="pct">${pct}</td>`;

    // Timeline cells — each column draws a colored cell when the row's
    // span overlaps the column's date range.
    const fill = barColor(row);
    const border = barBorderColor(row);
    for (const c of cols) {
      const cEnd = colEnd(c, granularity);
      const overlaps = row.start < cEnd && row.end > c;
      if (overlaps) {
        html += `<td class="timeline-cell" style="background:${fill};border-color:${border};">&nbsp;</td>`;
      } else {
        html += `<td class="timeline-cell">&nbsp;</td>`;
      }
    }
    html += "</tr>";
  });

  // Footer summary
  html += `<tr><td colspan="${metaHeaders.length + cols.length}" style="background:#f1f5f9;font-size:9pt;color:#475569;text-align:center;padding:6px;">`;
  html += `ייצוא מ-Multitask · ${fmtDateShort(from)} → ${fmtDateShort(to)} · ${rows.length} פריטים`;
  html += `</td></tr>`;

  html += "</table></body></html>";
  return html;
}

/** Trigger a download of the generated Excel-HTML blob. */
export function downloadGanttExcel(opts: ExportOptions): void {
  const html = buildGanttExcelHtml(opts);
  // BOM ensures Excel reads UTF-8 properly (Hebrew chars).
  const blob = new Blob(["﻿" + html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  const safeTitle = (opts.title ?? "Gantt").replace(/[^\p{L}\p{N}_\-]+/gu, "_").slice(0, 40);
  a.href = url;
  a.download = `${safeTitle}_${stamp}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
