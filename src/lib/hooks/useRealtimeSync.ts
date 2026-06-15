import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryFamilies } from "@/lib/query-keys";
import { useOrgScope } from "./useOrgScope";

/**
 * Subscribes to Supabase Realtime on the core tables for the active org
 * and invalidates the matching React Query caches on every change.
 *
 * Strategy: **invalidate, don't patch**. Realtime events tell us *something*
 * changed; React Query will refetch the correct shape with filters applied.
 *
 * Mount this ONCE at the AppShell level — not in every screen.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const { organizationId, userId, enabled } = useOrgScope();

  useEffect(() => {
    if (!enabled || !organizationId) return;

    const orgFilter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`org-${organizationId}`)
      // Tasks
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allTasks(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(changedId) });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_lists", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: queryFamilies.allTaskLists(organizationId) });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_dependencies" },
        () => {
          qc.invalidateQueries({
            queryKey: ["task-dependencies", organizationId],
          });
        }
      )
      // Projects
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allProjects(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.projectFamily(changedId) });
          }
        }
      )
      // Events
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allEvents(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.eventFamily(changedId) });
          }
        }
      )
      // Recordings
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recordings", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allRecordings(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.recordingFamily(changedId) });
          }
        }
      )
      // Thoughts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thoughts", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allThoughts(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.thoughtFamily(changedId) });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thought_lists", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: queryFamilies.allThoughtLists(organizationId) });
        }
      )
      // Time entries — scoped by user to limit noise
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const taskId =
            (payload.new as { task_id?: string })?.task_id ??
            (payload.old as { task_id?: string })?.task_id;
          if (taskId) {
            qc.invalidateQueries({ queryKey: ["task", taskId, "time-entries"] });
            qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(taskId) });
          }
          qc.invalidateQueries({ queryKey: ["timer", "active"] });
          qc.invalidateQueries({
            queryKey: queryFamilies.allTimeEntriesRange(organizationId),
          });
        }
      )
      // Notifications — scoped by user
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (userId) {
            qc.invalidateQueries({ queryKey: ["notifications", userId] });
          }
        }
      )
      // Shopping — household staples, store connections, runs + run items
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_staples", filter: orgFilter },
        () => {
          qc.invalidateQueries({
            queryKey: queryFamilies.allHouseholdStaples(organizationId),
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_connections", filter: orgFilter },
        () => {
          qc.invalidateQueries({
            queryKey: queryFamilies.allStoreConnections(organizationId),
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_runs", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(changedId) });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_run_items", filter: orgFilter },
        (payload) => {
          // Items don't carry the run's own id under `id`; refetch the run
          // family for the affected run plus the runs list (item counts/status).
          const runId =
            (payload.new as { run_id?: string })?.run_id ??
            (payload.old as { run_id?: string })?.run_id;
          if (runId) {
            qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(runId) });
          }
          qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(organizationId) });
        }
      )
      // Food planning — meals/menu are shared across the household, so live
      // updates matter here more than anywhere. Categories + template +
      // shares are cheap blanket invalidations.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meals", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: queryFamilies.allMeals(organizationId) });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingredients", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(organizationId) });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_plan_days", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["meal-plan-days", organizationId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_plan_template", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["meal-plan-template", organizationId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_plan_shares", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["meal-plan-shares", organizationId] });
        }
      )
      // Frameworks — blocks/labels don't carry organization_id, so those two
      // subscribe unfiltered (RLS still scopes the events) and invalidate the
      // whole framework content family.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "frameworks", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["frameworks", organizationId] });
          qc.invalidateQueries({ queryKey: ["framework"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "framework_blocks" },
        () => {
          qc.invalidateQueries({ queryKey: ["framework"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "framework_day_labels" },
        () => {
          qc.invalidateQueries({ queryKey: ["framework"] });
        }
      )
      // Goal plans — the plan lists themselves are task_lists (already
      // covered); decisions/impacts tables invalidate the plans family.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_decisions" },
        () => {
          qc.invalidateQueries({ queryKey: ["plans", organizationId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_decision_impacts" },
        () => {
          qc.invalidateQueries({ queryKey: ["plans", organizationId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_stage_impacts" },
        () => {
          qc.invalidateQueries({ queryKey: ["plans", organizationId] });
        }
      )
      // Contacts — org registry + per-project links.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["org-contacts", organizationId] });
          qc.invalidateQueries({ queryKey: ["project-contacts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, organizationId, userId, enabled]);
}
