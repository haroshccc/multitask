/**
 * Export service — JSON full backup + CSV task export.
 *
 * JSON backup: all org data (tasks, projects, thoughts, recordings, events, food).
 * CSV export:  tasks with full detail columns for Excel.
 */

import { supabase } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// JSON full backup
// ---------------------------------------------------------------------------

export interface OrgBackup {
  version: 2;
  exported_at: string;
  organization_id: string;
  data: {
    task_lists: unknown[];
    tasks: unknown[];
    projects: unknown[];
    project_expenses: unknown[];
    events: unknown[];
    thoughts: unknown[];
    thought_lists: unknown[];
    recordings: unknown[];
    meals: unknown[];
    meal_categories: unknown[];
    ingredients: unknown[];
    ingredient_categories: unknown[];
    meal_plan_days: unknown[];
  };
}

export async function buildFullBackup(organizationId: string): Promise<OrgBackup> {
  const db = supabase as any;

  const [
    { data: task_lists },
    { data: tasks },
    { data: projects },
    { data: project_expenses },
    { data: events },
    { data: thoughts },
    { data: thought_lists },
    { data: recordings },
    { data: meals },
    { data: meal_categories },
    { data: ingredients },
    { data: ingredient_categories },
    { data: meal_plan_days },
  ] = await Promise.all([
    db.from("task_lists").select("*").eq("organization_id", organizationId),
    db.from("tasks").select("*").eq("organization_id", organizationId),
    db.from("projects").select("*").eq("organization_id", organizationId),
    db.from("project_expenses").select("*, project:projects!inner(organization_id)").eq("projects.organization_id", organizationId),
    db.from("events").select("*").eq("organization_id", organizationId),
    db.from("thoughts").select("*").eq("organization_id", organizationId),
    db.from("thought_lists").select("*").eq("organization_id", organizationId),
    // Recordings: export metadata + transcript, no audio URLs (they are storage-signed)
    db.from("recordings")
      .select("id,title,created_at,updated_at,status,transcript_text,transcript_json,speakers_count,duration_seconds,source,organization_id,owner_id")
      .eq("organization_id", organizationId),
    db.from("meals").select("*, meal_ingredients(*)").eq("organization_id", organizationId),
    db.from("meal_categories").select("*").eq("organization_id", organizationId),
    db.from("ingredients").select("*, ingredient_units(*)").eq("organization_id", organizationId),
    db.from("ingredient_categories").select("*").eq("organization_id", organizationId),
    db.from("meal_plan_days").select("*").eq("organization_id", organizationId),
  ]);

  return {
    version: 2,
    exported_at: new Date().toISOString(),
    organization_id: organizationId,
    data: {
      task_lists: task_lists ?? [],
      tasks: tasks ?? [],
      projects: projects ?? [],
      project_expenses: project_expenses ?? [],
      events: events ?? [],
      thoughts: thoughts ?? [],
      thought_lists: thought_lists ?? [],
      recordings: recordings ?? [],
      meals: meals ?? [],
      meal_categories: meal_categories ?? [],
      ingredients: ingredients ?? [],
      ingredient_categories: ingredient_categories ?? [],
      meal_plan_days: meal_plan_days ?? [],
    },
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// CSV task export (Excel-compatible with UTF-8 BOM)
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  done: "הושלם",
  cancelled: "בוטל",
  blocked: "חסום",
};

const URGENCY_LABELS: Record<number, string> = {
  1: "נמוכה",
  2: "בינונית",
  3: "גבוהה",
  4: "דחופה",
};

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  urgency?: number | null;
  tags?: string[] | null;
  deadline_at?: string | null;
  scheduled_at?: string | null;
  recurrence_rule?: string | null;
  created_at?: string | null;
  task_list_id?: string | null;
  parent_task_id?: string | null;
  owner_id?: string | null;
  assignee_user_id?: string | null;
};

type TaskListRow = { id: string; name: string };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("he-IL");
  } catch {
    return iso;
  }
}

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function buildTasksCsv(organizationId: string): Promise<string> {
  const db = supabase as any;

  const [{ data: tasks }, { data: lists }] = await Promise.all([
    db
      .from("tasks")
      .select("id,title,description,status,urgency,tags,deadline_at,scheduled_at,recurrence_rule,created_at,task_list_id,parent_task_id,owner_id,assignee_user_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    db.from("task_lists").select("id,name").eq("organization_id", organizationId),
  ]);

  const listMap = new Map<string, string>(
    ((lists ?? []) as TaskListRow[]).map((l) => [l.id, l.name])
  );

  const rawRows: TaskRow[] = tasks ?? [];

  // Build title lookup and sort so parents appear before their children
  const titleById = new Map<string, string>(rawRows.map((t) => [t.id, t.title]));
  const rows = topoSort(rawRows);

  const headers = [
    "כותרת",
    "תת-משימה של",
    "תיאור",
    "סטטוס",
    "עדיפות",
    "תגיות",
    "תאריך יעד",
    "תאריך מתוכנן",
    "חזרתיות",
    "רשימה",
    "נוצר בתאריך",
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const t of rows) {
    const parentTitle = t.parent_task_id ? (titleById.get(t.parent_task_id) ?? "") : "";
    const cells = [
      t.title ?? "",
      parentTitle,
      t.description ?? "",
      STATUS_LABELS[t.status] ?? t.status ?? "",
      t.urgency != null ? (URGENCY_LABELS[t.urgency] ?? String(t.urgency)) : "",
      Array.isArray(t.tags) ? t.tags.join("; ") : "",
      formatDate(t.deadline_at),
      formatDate(t.scheduled_at),
      t.recurrence_rule ?? "",
      t.task_list_id ? (listMap.get(t.task_list_id) ?? "") : "",
      formatDate(t.created_at),
    ];
    lines.push(cells.map(escapeCsvCell).join(","));
  }

  // UTF-8 BOM so Excel opens Hebrew correctly
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// Shared download helper
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Sort tasks so each parent row appears before its children (depth-first).
function topoSort(tasks: TaskRow[]): TaskRow[] {
  const byId = new Map<string, TaskRow>(tasks.map((t) => [t.id, t]));
  const childrenOf = new Map<string | null, TaskRow[]>();
  for (const t of tasks) {
    const pid = t.parent_task_id && byId.has(t.parent_task_id) ? t.parent_task_id : null;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(t);
  }
  const out: TaskRow[] = [];
  const visit = (pid: string | null) => {
    for (const t of childrenOf.get(pid) ?? []) {
      out.push(t);
      visit(t.id);
    }
  };
  visit(null);
  return out;
}
