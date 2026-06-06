/**
 * Single source of truth for mapping the project tables (tasks / meetings /
 * payments) into {@link ExportSheet}s. Both the per-table "ייצוא לאקסל"
 * buttons and the dashboard "גיבוי והורדה" backup consume these builders so a
 * column added here shows up in every export.
 *
 * Every builder exports ALL columns — fixed + custom — regardless of the
 * per-project visibility settings, so the export is a complete snapshot.
 */
import type { ExportSheet } from "./xlsx";
import { readCustomField } from "@/components/configurable-table/fieldCells";
import type { TaskCustomField } from "@/lib/types/domain";
import type { Task } from "@/lib/types/domain";
import type { ProjectMeeting } from "@/lib/services/project-meetings";
import type { ProjectPayment } from "@/lib/services/project-payments";
import type { Contact } from "@/lib/services/contacts";

// ── Shared formatting helpers ────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds == null || seconds === 0) return null;
  return Math.round((seconds / 3600) * 100) / 100;
}

/**
 * Render a single custom-field value into a readable cell. Select chips are
 * resolved to their option label; tags/files become comma-joined text;
 * checkboxes become כן/לא; dates pass through readable formatting.
 */
function formatCustomValue(
  field: TaskCustomField,
  value: unknown
): string | number | null {
  if (value == null || value === "") return null;
  switch (field.field_type) {
    case "checkbox":
      return value ? "כן" : "לא";
    case "number":
    case "stars":
      return typeof value === "number" ? value : Number(value) || null;
    case "date":
      return formatDate(String(value));
    case "select": {
      const opts = (field.options as { value: string; label: string }[] | null) ?? [];
      const match = opts.find((o) => o.value === value);
      return match?.label ?? String(value);
    }
    case "tag":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "file":
      return Array.isArray(value)
        ? value
            .map((f) => (f && typeof f === "object" ? (f as { name?: string }).name : ""))
            .filter(Boolean)
            .join(", ")
        : "";
    default:
      return String(value);
  }
}

function customHeaders(fields: TaskCustomField[]): string[] {
  return fields.map((f) => f.field_label);
}

function customCells(
  row: { custom_fields: unknown },
  fields: TaskCustomField[]
): (string | number | null)[] {
  return fields.map((f) =>
    formatCustomValue(f, readCustomField(row as { custom_fields: any }, f.field_key))
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────

const TASK_FIXED_HEADERS = [
  "רמה",
  "משימה",
  "סטטוס",
  "שעות מוערכות",
  "ספייר",
  "דחיפות",
  "בפועל (שעות)",
  "הערות",
  "הושלמה בתאריך",
];

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  done: "הושלמה",
  blocked: "חסומה",
};

interface TaskTreeNode {
  task: Task;
  depth: number;
}

/**
 * Flatten the task tree depth-first so sub-tasks follow their parent, carrying
 * a depth level. Mirrors the table's parent→child ordering by `sort_order`.
 */
function flattenTasks(tasks: Task[]): TaskTreeNode[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const arr = byParent.get(t.parent_task_id) ?? [];
    arr.push(t);
    byParent.set(t.parent_task_id, arr);
  }
  const sortFn = (a: Task, b: Task) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const out: TaskTreeNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const task of (byParent.get(parentId) ?? []).slice().sort(sortFn)) {
      out.push({ task, depth });
      walk(task.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function buildTasksSheet(
  tasks: Task[],
  customFields: TaskCustomField[],
  sheetName = "משימות"
): ExportSheet {
  const headers = [...TASK_FIXED_HEADERS, ...customHeaders(customFields)];
  const rows = flattenTasks(tasks).map(({ task, depth }) => {
    const fixed: (string | number | null)[] = [
      depth + 1,
      task.title?.trim() || "",
      TASK_STATUS_LABEL[task.status] ?? task.status ?? "",
      task.estimated_hours ?? null,
      task.spare_hours ?? null,
      task.urgency ?? null,
      secondsToHours(task.actual_seconds),
      task.notes ?? "",
      formatDate(task.completed_at),
    ];
    return [...fixed, ...customCells(task, customFields)];
  });
  return { name: sheetName, headers, rows };
}

// ── Meetings ───────────────────────────────────────────────────────────────

const MEETING_FIXED_HEADERS = ["פגישה", "מתי", "סטטוס", "מיקום", "הערות", "סיכום"];

const MEETING_STATUS_LABEL: Record<string, string> = {
  scheduled: "מתוכננת",
  done: "התקיימה",
  cancelled: "בוטלה",
};

export function buildMeetingsSheet(
  meetings: ProjectMeeting[],
  customFields: TaskCustomField[],
  sheetName = "פגישות"
): ExportSheet {
  const headers = [...MEETING_FIXED_HEADERS, ...customHeaders(customFields)];
  const rows = meetings.map((m) => {
    const fixed: (string | number | null)[] = [
      m.title?.trim() || "",
      m.all_day ? formatDate(m.meeting_at) : formatDateTime(m.meeting_at),
      MEETING_STATUS_LABEL[m.status] ?? m.status ?? "",
      m.location ?? "",
      m.notes ?? "",
      m.summary ?? "",
    ];
    return [...fixed, ...customCells(m, customFields)];
  });
  return { name: sheetName, headers, rows };
}

// ── Contacts ─────────────────────────────────────────────────────────────────

const CONTACT_FIXED_HEADERS = [
  "שם",
  "סוג",
  "חברה",
  "ח.פ / ע.מ",
  "אימייל",
  "טלפון",
  "כתובת",
  "הערות",
];

const CONTACT_TYPE_LABEL: Record<string, string> = {
  customer: "לקוח",
  supplier: "ספק",
};

export function buildContactsSheet(
  contacts: Contact[],
  customFields: TaskCustomField[],
  sheetName = "אנשי קשר"
): ExportSheet {
  const headers = [...CONTACT_FIXED_HEADERS, ...customHeaders(customFields)];
  const rows = contacts.map((c) => {
    const fixed: (string | number | null)[] = [
      c.name?.trim() || "",
      CONTACT_TYPE_LABEL[c.type] ?? c.type ?? "",
      c.company ?? "",
      c.tax_id ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.address ?? "",
      c.notes ?? "",
    ];
    return [...fixed, ...customCells(c, customFields)];
  });
  return { name: sheetName, headers, rows };
}

// ── Payments ─────────────────────────────────────────────────────────────────

const PAYMENT_FIXED_HEADERS = [
  "תיאור",
  "סוג",
  "איש קשר",
  "סכום",
  "מטבע",
  "סטטוס",
  "תנאי תשלום",
  "תאריך דרישה",
  "לתשלום עד",
  "שולם בתאריך",
  "הערות",
];

const PAYMENT_DIRECTION_LABEL: Record<string, string> = {
  in: "תקבול",
  out: "תשלום",
};

/** Terms label (שוטף+N). null/0 → מיידי. */
function paymentTermsLabel(netDays: number | null | undefined): string {
  if (!netDays || netDays <= 0) return "מיידי";
  return `שוטף+${netDays}`;
}

/**
 * Derived status text matching the table/cards: a 'demand' whose due_date is in
 * the past renders as "באיחור".
 */
function paymentDerivedStatusText(
  status: string,
  direction: string,
  dueDate: string | null
): string {
  if (status === "demand" && dueDate) {
    const due = new Date(dueDate);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      if (today.getTime() > due.getTime()) return "באיחור";
    }
  }
  switch (status) {
    case "draft":
      return "צפוי";
    case "demand":
      return direction === "in" ? "דרישה נשלחה" : "דרישה התקבלה";
    case "paid":
      return direction === "in" ? "התקבל" : "שולם";
    case "cancelled":
      return "בוטל";
    default:
      return status ?? "";
  }
}

export function buildPaymentsSheet(
  payments: ProjectPayment[],
  customFields: TaskCustomField[],
  sheetName = "תשלומים",
  contacts: Contact[] = []
): ExportSheet {
  const contactName = new Map(contacts.map((c) => [c.id, c.name?.trim() || ""]));
  const headers = [...PAYMENT_FIXED_HEADERS, ...customHeaders(customFields)];
  const rows = payments.map((p) => {
    const fixed: (string | number | null)[] = [
      p.title?.trim() || "",
      PAYMENT_DIRECTION_LABEL[p.direction] ?? p.direction ?? "",
      p.contact_id ? contactName.get(p.contact_id) ?? "" : "",
      (p.amount_cents ?? 0) / 100,
      p.currency ?? "",
      paymentDerivedStatusText(p.status, p.direction, p.due_date),
      paymentTermsLabel(p.terms_net_days),
      formatDate(p.demand_date),
      formatDate(p.due_date),
      formatDate(p.paid_date),
      p.notes ?? "",
    ];
    return [...fixed, ...customCells(p, customFields)];
  });
  return { name: sheetName, headers, rows };
}
