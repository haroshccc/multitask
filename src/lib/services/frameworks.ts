/**
 * Frameworks ("מסגרת") data service.
 *
 * Framework tables are not in the generated Database type yet, so we cast the
 * client to `any` (`db`) per the project convention.
 */
import { supabase } from "@/lib/supabase/client";
import type {
  Framework,
  FrameworkInsert,
  FrameworkUpdate,
  FrameworkDayLabel,
  FrameworkDayLabelInsert,
  FrameworkDayLabelUpdate,
  FrameworkBlock,
  FrameworkBlockInsert,
  FrameworkBlockUpdate,
  FrameworkBlockOccurrence,
  FrameworkOccurrenceStatus,
  FrameworkVisibility,
  FrameworkShare,
  FrameworkHistoryEntry,
  FrameworkHistoryEntityType,
  FrameworkHistoryAction,
} from "@/lib/types/frameworks";

const db = supabase as any;

export interface FrameworkContent {
  labels: FrameworkDayLabel[];
  blocks: FrameworkBlock[];
  occurrences: FrameworkBlockOccurrence[];
}

// ── history ──────────────────────────────────────────────────────────────────

async function logHistory(args: {
  framework_id: string;
  organization_id: string;
  entity_type: FrameworkHistoryEntityType;
  entity_id?: string | null;
  action: FrameworkHistoryAction;
  summary?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  // Best-effort: history must never break the primary mutation.
  try {
    await db.from("framework_history").insert({
      framework_id: args.framework_id,
      organization_id: args.organization_id,
      entity_type: args.entity_type,
      entity_id: args.entity_id ?? null,
      action: args.action,
      summary: args.summary ?? null,
      details: args.details ?? null,
    });
  } catch {
    /* swallow */
  }
}

export async function listFrameworkHistory(
  frameworkId: string
): Promise<FrameworkHistoryEntry[]> {
  const { data, error } = await db
    .from("framework_history")
    .select("*")
    .eq("framework_id", frameworkId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as FrameworkHistoryEntry[];
}

// ── frameworks ───────────────────────────────────────────────────────────────

export async function listFrameworks(
  organizationId: string,
  includeArchived = false
): Promise<Framework[]> {
  let query = db
    .from("frameworks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Framework[];
}

export async function getFramework(id: string): Promise<Framework | null> {
  const { data, error } = await db.from("frameworks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Framework | null;
}

export async function createFramework(payload: FrameworkInsert): Promise<Framework> {
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const { data: last } = await db
      .from("frameworks")
      .select("sort_order")
      .eq("organization_id", payload.organization_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  }
  const { data, error } = await db
    .from("frameworks")
    .insert({ ...payload, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  const fw = data as Framework;
  await logHistory({
    framework_id: fw.id,
    organization_id: fw.organization_id,
    entity_type: "framework",
    entity_id: fw.id,
    action: "create",
    summary: `נוצרה מסגרת "${fw.name}"`,
  });
  return fw;
}

export async function updateFramework(
  id: string,
  patch: FrameworkUpdate
): Promise<Framework> {
  const { data, error } = await db
    .from("frameworks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const fw = data as Framework;
  await logHistory({
    framework_id: fw.id,
    organization_id: fw.organization_id,
    entity_type: "framework",
    entity_id: fw.id,
    action: "update",
    summary: "עודכנה מסגרת",
    details: patch as Record<string, unknown>,
  });
  return fw;
}

export async function deleteFramework(id: string): Promise<void> {
  const { error } = await db.from("frameworks").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderFrameworks(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map((u) => db.from("frameworks").update({ sort_order: u.sort_order }).eq("id", u.id))
  );
}

// ── content (labels + blocks + occurrences) ──────────────────────────────────

export async function getFrameworkContent(frameworkId: string): Promise<FrameworkContent> {
  const [labels, blocks, occurrences] = await Promise.all([
    db.from("framework_day_labels").select("*").eq("framework_id", frameworkId),
    db.from("framework_blocks").select("*").eq("framework_id", frameworkId),
    db.from("framework_block_occurrences").select("*").eq("framework_id", frameworkId),
  ]);
  if (labels.error) throw labels.error;
  if (blocks.error) throw blocks.error;
  if (occurrences.error) throw occurrences.error;
  return {
    labels: (labels.data ?? []) as FrameworkDayLabel[],
    blocks: (blocks.data ?? []) as FrameworkBlock[],
    occurrences: (occurrences.data ?? []) as FrameworkBlockOccurrence[],
  };
}

/** Bulk content for several frameworks at once (calendar layer). */
export async function getFrameworkContentForMany(
  frameworkIds: string[]
): Promise<Record<string, FrameworkContent>> {
  const result: Record<string, FrameworkContent> = {};
  if (frameworkIds.length === 0) return result;
  const [labels, blocks, occurrences] = await Promise.all([
    db.from("framework_day_labels").select("*").in("framework_id", frameworkIds),
    db.from("framework_blocks").select("*").in("framework_id", frameworkIds),
    db.from("framework_block_occurrences").select("*").in("framework_id", frameworkIds),
  ]);
  if (labels.error) throw labels.error;
  if (blocks.error) throw blocks.error;
  if (occurrences.error) throw occurrences.error;
  for (const id of frameworkIds) result[id] = { labels: [], blocks: [], occurrences: [] };
  for (const l of (labels.data ?? []) as FrameworkDayLabel[]) result[l.framework_id]?.labels.push(l);
  for (const b of (blocks.data ?? []) as FrameworkBlock[]) result[b.framework_id]?.blocks.push(b);
  for (const o of (occurrences.data ?? []) as FrameworkBlockOccurrence[])
    result[o.framework_id]?.occurrences.push(o);
  return result;
}

// ── day labels ───────────────────────────────────────────────────────────────

export async function createDayLabel(
  payload: FrameworkDayLabelInsert
): Promise<FrameworkDayLabel> {
  const { data, error } = await db
    .from("framework_day_labels")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  const row = data as FrameworkDayLabel;
  await logHistory({
    framework_id: row.framework_id,
    organization_id: row.organization_id,
    entity_type: "day_label",
    entity_id: row.id,
    action: "create",
    summary: `נוספה כותרת יום "${row.label}"`,
  });
  return row;
}

export async function updateDayLabel(
  id: string,
  patch: FrameworkDayLabelUpdate
): Promise<FrameworkDayLabel> {
  const { data, error } = await db
    .from("framework_day_labels")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const row = data as FrameworkDayLabel;
  await logHistory({
    framework_id: row.framework_id,
    organization_id: row.organization_id,
    entity_type: "day_label",
    entity_id: row.id,
    action: "update",
    summary: "עודכנה כותרת יום",
    details: patch as Record<string, unknown>,
  });
  return row;
}

export async function deleteDayLabel(id: string): Promise<void> {
  const { error } = await db.from("framework_day_labels").delete().eq("id", id);
  if (error) throw error;
}

// ── blocks ───────────────────────────────────────────────────────────────────

export async function createBlock(payload: FrameworkBlockInsert): Promise<FrameworkBlock> {
  const { data, error } = await db.from("framework_blocks").insert(payload).select().single();
  if (error) throw error;
  const row = data as FrameworkBlock;
  await logHistory({
    framework_id: row.framework_id,
    organization_id: row.organization_id,
    entity_type: "block",
    entity_id: row.id,
    action: "create",
    summary: `נוסף בלוק "${row.title}"`,
  });
  return row;
}

export async function updateBlock(
  id: string,
  patch: FrameworkBlockUpdate
): Promise<FrameworkBlock> {
  const { data, error } = await db
    .from("framework_blocks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const row = data as FrameworkBlock;
  await logHistory({
    framework_id: row.framework_id,
    organization_id: row.organization_id,
    entity_type: "block",
    entity_id: row.id,
    action: "update",
    summary: "עודכן בלוק",
    details: patch as Record<string, unknown>,
  });
  return row;
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await db.from("framework_blocks").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Apply a "this occurrence only" edit to a weekly block on one date by writing
 * a date-scoped override row (modify/remove) pointing back at the source block.
 */
export async function upsertBlockOverride(
  payload: FrameworkBlockInsert & { source_block_id: string; specific_date: string }
): Promise<FrameworkBlock> {
  const { data, error } = await db
    .from("framework_blocks")
    .insert({ ...payload, scope: "date" })
    .select()
    .single();
  if (error) throw error;
  return data as FrameworkBlock;
}

// ── occurrence check/skip ────────────────────────────────────────────────────

export async function setBlockOccurrence(args: {
  blockId: string;
  frameworkId: string;
  organizationId: string;
  date: string;
  status: FrameworkOccurrenceStatus | null;
}): Promise<void> {
  if (args.status === null) {
    const { error } = await db
      .from("framework_block_occurrences")
      .delete()
      .eq("block_id", args.blockId)
      .eq("occ_date", args.date);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("framework_block_occurrences").upsert(
    {
      block_id: args.blockId,
      framework_id: args.frameworkId,
      organization_id: args.organizationId,
      occ_date: args.date,
      status: args.status,
    },
    { onConflict: "block_id,occ_date" }
  );
  if (error) throw error;
}

// ── visibility (per-user calendar on/off) ────────────────────────────────────

export async function listFrameworkVisibility(): Promise<FrameworkVisibility[]> {
  const { data, error } = await db.from("framework_visibility").select("*");
  if (error) throw error;
  return (data ?? []) as FrameworkVisibility[];
}

export async function setFrameworkVisibility(
  userId: string,
  frameworkId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await db.from("framework_visibility").upsert(
    { user_id: userId, framework_id: frameworkId, is_active: isActive },
    { onConflict: "user_id,framework_id" }
  );
  if (error) throw error;
}

// ── shares (view-only) ───────────────────────────────────────────────────────

export async function listFrameworkShares(frameworkId: string): Promise<FrameworkShare[]> {
  const { data, error } = await db
    .from("framework_shares")
    .select("*")
    .eq("framework_id", frameworkId);
  if (error) throw error;
  return (data ?? []) as FrameworkShare[];
}

export async function addFrameworkShare(
  organizationId: string,
  frameworkId: string,
  userId: string
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db.from("framework_shares").upsert(
    {
      organization_id: organizationId,
      framework_id: frameworkId,
      user_id: userId,
      granted_by: auth?.user?.id ?? null,
    },
    { onConflict: "framework_id,user_id" }
  );
  if (error) throw error;
  await logHistory({
    framework_id: frameworkId,
    organization_id: organizationId,
    entity_type: "share",
    action: "create",
    summary: "שותפה מסגרת (צפייה)",
  });
}

export async function removeFrameworkShare(
  frameworkId: string,
  userId: string
): Promise<void> {
  const { error } = await db
    .from("framework_shares")
    .delete()
    .eq("framework_id", frameworkId)
    .eq("user_id", userId);
  if (error) throw error;
}
