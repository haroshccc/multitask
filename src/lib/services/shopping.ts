import { supabase } from "@/lib/supabase/client";
import type {
  HouseholdStaple,
  HouseholdStapleInsert,
  HouseholdStapleUpdate,
  StoreConnection,
  StoreConnectionInsert,
  StoreConnectionUpdate,
  ShoppingRun,
  ShoppingRunInsert,
  ShoppingRunUpdate,
  ShoppingRunItem,
  ShoppingItemStatus,
} from "@/lib/types/domain";
import type { ShoppingRunItemDraft } from "@/lib/food/shopping-list";

// =============================================================================
// Household staples
// =============================================================================

export async function listHouseholdStaples(
  orgId: string
): Promise<HouseholdStaple[]> {
  const { data, error } = await supabase
    .from("household_staples")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createHouseholdStaple(
  payload: HouseholdStapleInsert
): Promise<HouseholdStaple> {
  const { data, error } = await supabase
    .from("household_staples")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHouseholdStaple(
  id: string,
  patch: HouseholdStapleUpdate
): Promise<HouseholdStaple> {
  const { data, error } = await supabase
    .from("household_staples")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHouseholdStaple(id: string): Promise<void> {
  const { error } = await supabase.from("household_staples").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Store connections
// =============================================================================

export async function listStoreConnections(
  orgId: string
): Promise<StoreConnection[]> {
  const { data, error } = await supabase
    .from("store_connections")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createStoreConnection(
  payload: StoreConnectionInsert
): Promise<StoreConnection> {
  const { data, error } = await supabase
    .from("store_connections")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStoreConnection(
  id: string,
  patch: StoreConnectionUpdate
): Promise<StoreConnection> {
  const { data, error } = await supabase
    .from("store_connections")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStoreConnection(id: string): Promise<void> {
  const { error } = await supabase.from("store_connections").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Shopping runs (frozen snapshots) + their items
// =============================================================================

/** A run with its item lines bundled — what the tracker screen displays. */
export interface ShoppingRunWithItems extends ShoppingRun {
  items: ShoppingRunItem[];
}

export async function listShoppingRuns(orgId: string): Promise<ShoppingRun[]> {
  const { data, error } = await supabase
    .from("shopping_runs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getShoppingRun(
  runId: string
): Promise<ShoppingRunWithItems | null> {
  const { data, error } = await supabase
    .from("shopping_runs")
    .select("*, items:shopping_run_items(*)")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const items = (
    (data as unknown as { items: ShoppingRunItem[] }).items ?? []
  ).sort((a, b) => a.sort_order - b.sort_order);
  return { ...(data as ShoppingRun), items } as ShoppingRunWithItems;
}

/**
 * Creates a frozen run from a set of item drafts (menu-derived + ticked
 * staples). Inserts the run row, then its items in one batch. Bumps
 * last_added_at on any staples that were included so the suggestion heuristic
 * reflects that they were just shopped for.
 */
export async function createRunFromDrafts(input: {
  organizationId: string;
  createdBy: string;
  title: string;
  fromDate: string;
  toDate: string;
  includedUserIds: string[];
  storeConnectionId: string | null;
  drafts: ShoppingRunItemDraft[];
}): Promise<ShoppingRun> {
  const runPayload: ShoppingRunInsert = {
    organization_id: input.organizationId,
    created_by: input.createdBy,
    title: input.title,
    status: "open",
    frozen_from_date: input.fromDate,
    frozen_to_date: input.toDate,
    included_user_ids: input.includedUserIds,
    store_connection_id: input.storeConnectionId,
  };
  const { data: run, error: runErr } = await supabase
    .from("shopping_runs")
    .insert(runPayload)
    .select()
    .single();
  if (runErr) throw runErr;

  if (input.drafts.length > 0) {
    const rows = input.drafts.map((d, i) => ({
      run_id: run.id,
      organization_id: input.organizationId,
      ingredient_id: d.ingredientId,
      staple_id: d.stapleId,
      name: d.name,
      quantity: d.quantity,
      unit: d.unit,
      category_id: d.categoryId,
      source: d.source,
      status: "needed" as const,
      source_meals: d.sourceMeals,
      sort_order: i,
    }));
    const { error: itemsErr } = await supabase
      .from("shopping_run_items")
      .insert(rows);
    if (itemsErr) throw itemsErr;

    // Touch last_added_at on the staples we just shopped for.
    const stapleIds = input.drafts
      .map((d) => d.stapleId)
      .filter((id): id is string => !!id);
    if (stapleIds.length > 0) {
      await supabase
        .from("household_staples")
        .update({ last_added_at: new Date().toISOString() })
        .in("id", stapleIds);
    }
  }

  return run;
}

export async function updateShoppingRun(
  id: string,
  patch: ShoppingRunUpdate
): Promise<ShoppingRun> {
  const { data, error } = await supabase
    .from("shopping_runs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShoppingRun(id: string): Promise<void> {
  const { error } = await supabase.from("shopping_runs").delete().eq("id", id);
  if (error) throw error;
}

// --- run items ---------------------------------------------------------------

export async function setRunItemStatus(
  itemId: string,
  status: ShoppingItemStatus
): Promise<ShoppingRunItem> {
  const { data, error } = await supabase
    .from("shopping_run_items")
    .update({ status })
    .eq("id", itemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Bulk status update — used by the reconciliation screen ("mark all
 *  remaining as received", etc.). */
export async function setRunItemsStatus(
  itemIds: string[],
  status: ShoppingItemStatus
): Promise<void> {
  if (itemIds.length === 0) return;
  const { error } = await supabase
    .from("shopping_run_items")
    .update({ status })
    .in("id", itemIds);
  if (error) throw error;
}

export async function addManualRunItem(input: {
  runId: string;
  organizationId: string;
  name: string;
  quantity: number;
  unit: string | null;
  categoryId: string | null;
  sortOrder: number;
}): Promise<ShoppingRunItem> {
  const { data, error } = await supabase
    .from("shopping_run_items")
    .insert({
      run_id: input.runId,
      organization_id: input.organizationId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      category_id: input.categoryId,
      source: "manual",
      status: "needed",
      sort_order: input.sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRunItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("shopping_run_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// =============================================================================
// Carry-over (merge) — pull 'missing' items from other open runs into one run
// =============================================================================

/** Open/active runs (not closed) that have at least one 'missing' item, with
 *  the missing items bundled — drives the "you have N items that didn't
 *  arrive — carry them over?" prompt. Excludes `excludeRunId` (the run we're
 *  carrying INTO). */
export async function listRunsWithMissingItems(
  orgId: string,
  excludeRunId?: string
): Promise<ShoppingRunWithItems[]> {
  const { data, error } = await supabase
    .from("shopping_runs")
    .select("*, items:shopping_run_items(*)")
    .eq("organization_id", orgId)
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const runs = (data ?? []) as unknown as ShoppingRunWithItems[];
  return runs
    .filter((r) => r.id !== excludeRunId)
    .map((r) => ({
      ...r,
      items: (r.items ?? []).filter((it) => it.status === "missing"),
    }))
    .filter((r) => r.items.length > 0);
}

/**
 * Carries selected items into `targetRunId`: copies each as a new line
 * (source='carryover', carried_from_run_id = original run) and marks the
 * originals as 'moved' so they leave the active view without being deleted
 * (preserving history + preventing duplicates). Returns a reversible snapshot
 * for Undo: the created item ids + the original ids that were flipped.
 */
export async function mergeRunItems(input: {
  targetRunId: string;
  organizationId: string;
  items: ShoppingRunItem[];
}): Promise<{ createdItemIds: string[]; movedFromIds: string[] }> {
  if (input.items.length === 0) return { createdItemIds: [], movedFromIds: [] };

  // Place carried items at the end of the target run.
  const { data: existing } = await supabase
    .from("shopping_run_items")
    .select("sort_order")
    .eq("run_id", input.targetRunId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

  const rows = input.items.map((it) => ({
    run_id: input.targetRunId,
    organization_id: input.organizationId,
    ingredient_id: it.ingredient_id,
    staple_id: it.staple_id,
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    category_id: it.category_id,
    source: "carryover" as const,
    status: "needed" as const,
    source_meals: it.source_meals,
    carried_from_run_id: it.run_id,
    sort_order: nextSort++,
  }));

  const { data: created, error: insErr } = await supabase
    .from("shopping_run_items")
    .insert(rows)
    .select("id");
  if (insErr) throw insErr;

  const movedFromIds = input.items.map((it) => it.id);
  const { error: moveErr } = await supabase
    .from("shopping_run_items")
    .update({ status: "moved" })
    .in("id", movedFromIds);
  if (moveErr) throw moveErr;

  return {
    createdItemIds: (created ?? []).map((r) => r.id),
    movedFromIds,
  };
}

/** Reverses a mergeRunItems: deletes the carried copies and restores the
 *  originals to 'missing'. Used by Undo. */
export async function unmergeRunItems(input: {
  createdItemIds: string[];
  movedFromIds: string[];
}): Promise<void> {
  if (input.createdItemIds.length > 0) {
    await supabase
      .from("shopping_run_items")
      .delete()
      .in("id", input.createdItemIds);
  }
  if (input.movedFromIds.length > 0) {
    await supabase
      .from("shopping_run_items")
      .update({ status: "missing" })
      .in("id", input.movedFromIds);
  }
}
