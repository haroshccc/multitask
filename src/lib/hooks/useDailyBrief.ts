import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/daily-brief";
import type {
  DailyBrief,
  ProposalDecision,
  ProposalDecisions,
} from "@/lib/types/domain";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Read the cached brief for (view, anchor). Falls back to `null` if no brief
 * has been generated yet — the caller's UI shows a "צרי סיכום" button which
 * triggers `useGenerateDailyBrief`.
 *
 * Phase 8.2 default: cache-first. The brief stays fresh for the lifetime of
 * the period (a day/week/month) unless the user pulls "🔄 רענן" — that
 * invokes the edge function with `force:true`, costs an AI call, and replaces
 * the row.
 */
export function useDailyBrief(args: {
  view: "day" | "week" | "month";
  anchor: string;
  enabled?: boolean;
}) {
  const { profile } = useAuth();
  const userId = profile?.id;
  return useQuery<DailyBrief | null>({
    queryKey: userId
      ? queryKeys.dailyBrief(userId, args.view, args.anchor)
      : ["daily-brief", "anon"],
    queryFn: () =>
      service.loadCachedBrief({ view: args.view, anchor: args.anchor }),
    enabled: !!userId && (args.enabled ?? true),
    staleTime: 5 * 60_000, // briefs change rarely; let cache breathe
  });
}

/**
 * Mutation that calls the edge function. Use `mutate({ force: true })` for the
 * manual refresh button, or `mutate({})` for "load if missing" first-fetch.
 *
 * On success we update the React Query cache directly with the fresh row.
 */
export function useGenerateDailyBrief(args: {
  view: "day" | "week" | "month";
  anchor: string;
  /** Local-tz [from, to) ISO range — pass `useDateRange().range` so the AI's
   *  "today" matches what the user sees on screen. */
  from?: string;
  to?: string;
}) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id;
  return useMutation<DailyBrief, Error, { force?: boolean } | void>({
    mutationFn: (vars) =>
      service.generateBrief({
        view: args.view,
        anchor: args.anchor,
        from: args.from,
        to: args.to,
        force: vars?.force ?? false,
      }),
    onSuccess: (brief) => {
      if (!userId) return;
      qc.setQueryData(
        queryKeys.dailyBrief(userId, args.view, args.anchor),
        brief
      );
    },
  });
}

/**
 * Phase 8.3 — record a per-proposal decision on the brief row. Used by the
 * approve / dismiss / edit handlers. Optimistic: we patch the cache locally
 * first and roll back if the DB write fails.
 */
export function useRecordProposalDecision() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id;
  return useMutation<
    DailyBrief,
    Error,
    {
      brief: DailyBrief;
      proposalId: string;
      decision: ProposalDecision;
    },
    { previous?: DailyBrief | null }
  >({
    mutationFn: (vars) =>
      service.recordProposalDecision({
        briefId: vars.brief.id,
        proposalId: vars.proposalId,
        decision: vars.decision,
      }),
    onMutate: async (vars) => {
      if (!userId) return {};
      const key = queryKeys.dailyBrief(userId, vars.brief.view, vars.brief.anchor);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DailyBrief | null>(key) ?? null;
      qc.setQueryData<DailyBrief | null>(key, (curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          proposal_decisions: {
            ...curr.proposal_decisions,
            [vars.proposalId]: vars.decision,
          },
        };
      });
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (!userId || !ctx?.previous) return;
      const key = queryKeys.dailyBrief(userId, vars.brief.view, vars.brief.anchor);
      qc.setQueryData(key, ctx.previous);
    },
    onSettled: (data, _err, vars) => {
      if (!userId) return;
      const key = queryKeys.dailyBrief(userId, vars.brief.view, vars.brief.anchor);
      if (data) qc.setQueryData(key, data);
    },
  });
}

/**
 * Bulk variant — used by the "אשר הכל / דחה הכל" toolbar. One server roundtrip
 * for N decisions. Optimistically patches the cache so the cards collapse
 * instantly.
 */
export function useRecordProposalDecisionsBatch() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const userId = profile?.id;
  return useMutation<
    DailyBrief,
    Error,
    {
      brief: DailyBrief;
      decisions: ProposalDecisions;
    },
    { previous?: DailyBrief | null }
  >({
    mutationFn: (vars) =>
      service.recordProposalDecisionsBatch({
        briefId: vars.brief.id,
        decisions: vars.decisions,
      }),
    onMutate: async (vars) => {
      if (!userId) return {};
      const key = queryKeys.dailyBrief(userId, vars.brief.view, vars.brief.anchor);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DailyBrief | null>(key) ?? null;
      qc.setQueryData<DailyBrief | null>(key, (curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          proposal_decisions: { ...curr.proposal_decisions, ...vars.decisions },
        };
      });
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (!userId || !ctx?.previous) return;
      const key = queryKeys.dailyBrief(userId, vars.brief.view, vars.brief.anchor);
      qc.setQueryData(key, ctx.previous);
    },
    onSettled: (data, _err, vars) => {
      if (!userId) return;
      const key = queryKeys.dailyBrief(userId, vars.brief.view, vars.brief.anchor);
      if (data) qc.setQueryData(key, data);
    },
  });
}
