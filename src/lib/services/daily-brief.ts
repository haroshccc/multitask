import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";
import type {
  DailyBrief,
  DailyBriefRow,
  BriefOutput,
  Proposal,
  ProposalDecision,
  ProposalDecisions,
  ProposalPayload,
} from "@/lib/types/domain";

/**
 * Phase 8.2 / 8.3 — daily brief service. Three operations:
 *   1. `loadCachedBrief` — read the brief row directly from the table
 *      (RLS limits it to the requesting user). Cheap, no AI involved.
 *   2. `generateBrief` — call the `daily-brief` edge function which gathers
 *      context, calls Claude, and upserts the row. Costs an Anthropic call.
 *   3. `recordProposalDecision` — update the `proposal_decisions` jsonb on a
 *      brief row to mark a proposal as approved / dismissed / edited. Local
 *      operation, no AI.
 */

function rowToBrief(row: DailyBriefRow): DailyBrief {
  return {
    ...row,
    output: (row.output as unknown as BriefOutput) ?? {
      summary: "",
      people_summary: [],
      recordings_digest: "",
      productive_hours_insight: "",
      recommendations: [],
    },
    proposals: (row.proposals as unknown as Proposal[]) ?? [],
    proposal_decisions:
      (row.proposal_decisions as unknown as ProposalDecisions) ?? {},
  };
}

export async function loadCachedBrief(args: {
  view: "day" | "week" | "month";
  anchor: string;
}): Promise<DailyBrief | null> {
  const { data, error } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("view", args.view)
    .eq("anchor", args.anchor)
    // RLS already restricts to user_id = auth.uid(); we let it filter implicitly
    // so swapping orgs (in the future) doesn't require a service-role call here.
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // No row is fine; only surface real errors.
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? rowToBrief(data) : null;
}

interface InvokeResult {
  ok: boolean;
  brief?: DailyBriefRow;
  cached?: boolean;
  error?: string;
  message?: string;
}

export async function generateBrief(args: {
  view: "day" | "week" | "month";
  anchor: string;
  /** Local-tz [from, to) ISO range. Optional — when provided the edge function
   *  uses it directly instead of recomputing from anchor (which it'd interpret
   *  as UTC midnight). Pass this from `useDateRange().range` to keep the AI's
   *  view of "today" matched to the user's local clock.
   */
  from?: string;
  to?: string;
  /** When true the edge function ignores the cache and always re-asks Claude. */
  force?: boolean;
}): Promise<DailyBrief> {
  const { data, error } = await supabase.functions.invoke<InvokeResult>(
    "daily-brief",
    {
      body: {
        view: args.view,
        anchor: args.anchor,
        from: args.from,
        to: args.to,
        force: args.force ?? false,
      },
    }
  );
  if (error) {
    throw new Error(error.message ?? "daily_brief_failed");
  }
  if (!data?.ok || !data.brief) {
    throw new Error(data?.message ?? data?.error ?? "daily_brief_no_payload");
  }
  return rowToBrief(data.brief);
}

/**
 * Update the per-proposal decision jsonb for a brief row. Used by 8.3 to mark
 * a proposal approved / dismissed / edited so the UI can hide it on next load
 * and the action log persists.
 *
 * We do a read-modify-write rather than a JSON merge in SQL because:
 *   - the table is tiny per user (≤ 3 rows usually visible at once),
 *   - it keeps the migration simple (no jsonb_set RPC),
 *   - we want to atomically include applied_target_id + applied_at on approval.
 */
export async function recordProposalDecision(args: {
  briefId: string;
  proposalId: string;
  decision: ProposalDecision;
}): Promise<DailyBrief> {
  const { data: existing, error: readErr } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("id", args.briefId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!existing) throw new Error("brief_not_found");
  const decisions =
    (existing.proposal_decisions as unknown as ProposalDecisions) ?? {};
  const next = { ...decisions, [args.proposalId]: args.decision };
  const { data: updated, error: upErr } = await supabase
    .from("daily_briefs")
    .update({ proposal_decisions: next as unknown as Json })
    .eq("id", args.briefId)
    .select()
    .single();
  if (upErr) throw upErr;
  return rowToBrief(updated);
}

/**
 * Same as `recordProposalDecision`, but applies multiple decisions in one
 * read-modify-write — used by the "אשר הכל / דחה הכל" bulk actions to avoid
 * N round-trips and the lost-update race that would entail.
 */
export async function recordProposalDecisionsBatch(args: {
  briefId: string;
  decisions: Record<string, ProposalDecision>;
}): Promise<DailyBrief> {
  const { data: existing, error: readErr } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("id", args.briefId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!existing) throw new Error("brief_not_found");
  const decisions =
    (existing.proposal_decisions as unknown as ProposalDecisions) ?? {};
  const next = { ...decisions, ...args.decisions };
  const { data: updated, error: upErr } = await supabase
    .from("daily_briefs")
    .update({ proposal_decisions: next as unknown as Json })
    .eq("id", args.briefId)
    .select()
    .single();
  if (upErr) throw upErr;
  return rowToBrief(updated);
}

/** Apply a proposal client-side and record the decision. The actual mutation
 *  (move / schedule / create event / ...) is handled by the caller; this
 *  function just records the outcome on the brief row.
 */
export type EditedProposal = Proposal & { payload: ProposalPayload["payload"] };
