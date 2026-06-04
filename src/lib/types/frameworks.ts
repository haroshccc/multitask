/**
 * Frameworks ("מסגרת") — domain types.
 *
 * A framework is its own entity (NOT a task). It is a recurring routine that
 * owns per-day labels and recurring time blocks, reuses task-like UX
 * (recurrence, calendar rendering, check/skip, goals) and is isolated from the
 * tasks/task_lists save path.
 *
 * These tables are not part of the generated `database.ts` Database type, so we
 * declare the shapes here. Services cast the supabase client to `any` (`db`).
 */

export type FrameworkScope = "weekly" | "date" | "monthly";
export type FrameworkPeriodUnit = "hour" | "day" | "week" | "month";
export type FrameworkOverrideKind = "add" | "remove" | "modify";
export type FrameworkOccurrenceStatus = "done" | "skipped";
export type FrameworkGoalPeriod = "day" | "week" | "month";

export interface Framework {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  color: string | null;
  emoji: string | null;
  run_start: string | null;
  run_end: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type FrameworkInsert = Omit<
  Framework,
  "id" | "created_at" | "updated_at" | "sort_order" | "is_archived"
> & {
  id?: string;
  sort_order?: number;
  is_archived?: boolean;
};

export type FrameworkUpdate = Partial<
  Omit<Framework, "id" | "organization_id" | "owner_id" | "created_at" | "updated_at">
>;

/** A per-day header title shown above each day column ("יום לימודים"). */
export interface FrameworkDayLabel {
  id: string;
  framework_id: string;
  organization_id: string;
  scope: FrameworkScope;
  day_of_week: number | null;
  specific_date: string | null;
  /** Periodic (scope='monthly'): repeat every N units (>=1). */
  month_interval: number | null;
  /** Periodic: reference date — defines the phase and (for months) day-of-month. */
  month_anchor: string | null;
  /** Periodic: the unit the interval counts in. */
  period_unit: FrameworkPeriodUnit;
  label: string;
  color: string | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export type FrameworkDayLabelInsert = Omit<
  FrameworkDayLabel,
  "id" | "created_at" | "updated_at"
> & { id?: string };

export type FrameworkDayLabelUpdate = Partial<
  Omit<FrameworkDayLabel, "id" | "framework_id" | "organization_id" | "created_at" | "updated_at">
>;

/** A recurring time block — the faded background event and the goal-tracked unit. */
export interface FrameworkBlock {
  id: string;
  framework_id: string;
  organization_id: string;
  title: string;
  color: string | null;
  scope: FrameworkScope;
  day_of_week: number | null;
  specific_date: string | null;
  /** Periodic (scope='monthly'): repeat every N units (>=1). */
  month_interval: number | null;
  /** Periodic: reference date — defines the phase and (for months) day-of-month. */
  month_anchor: string | null;
  /** Periodic: the unit the interval counts in. */
  period_unit: FrameworkPeriodUnit;
  start_minute: number;
  end_minute: number;
  effective_from: string | null;
  effective_to: string | null;
  override_kind: FrameworkOverrideKind | null;
  source_block_id: string | null;
  goal_period: FrameworkGoalPeriod | null;
  goal_target: number | null;
  goal_started_on: string | null;
  goal_min_streak_periods: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type FrameworkBlockInsert = Omit<
  FrameworkBlock,
  "id" | "created_at" | "updated_at" | "sort_order"
> & { id?: string; sort_order?: number };

export type FrameworkBlockUpdate = Partial<
  Omit<FrameworkBlock, "id" | "framework_id" | "organization_id" | "created_at" | "updated_at">
>;

/** Check/skip state for one block on one date. */
export interface FrameworkBlockOccurrence {
  id: string;
  block_id: string;
  framework_id: string;
  organization_id: string;
  occ_date: string;
  status: FrameworkOccurrenceStatus;
  created_at: string;
  updated_at: string;
}

/** Per-user "is this framework shown on the calendar" toggle. */
export interface FrameworkVisibility {
  user_id: string;
  framework_id: string;
  is_active: boolean;
}

/** View-only share grant for an entire framework. */
export interface FrameworkShare {
  id: string;
  organization_id: string;
  framework_id: string;
  user_id: string;
  granted_by: string | null;
  created_at: string;
}

export type FrameworkHistoryEntityType =
  | "framework"
  | "day_label"
  | "block"
  | "occurrence"
  | "share";
export type FrameworkHistoryAction = "create" | "update" | "delete";

export interface FrameworkHistoryEntry {
  id: string;
  framework_id: string;
  organization_id: string;
  actor_id: string | null;
  entity_type: FrameworkHistoryEntityType;
  entity_id: string | null;
  action: FrameworkHistoryAction;
  summary: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * A concrete, dated occurrence produced by projecting a framework over a date
 * window. Mirrors the calendar's item shape closely enough to render alongside
 * tasks/events as a distinct (faded) layer.
 */
export interface FrameworkBlockOccurrenceView {
  /** Synthesized id: `fwblock:<blockId>:<yyyy-mm-dd>`. */
  id: string;
  frameworkId: string;
  blockId: string;
  title: string;
  color: string | null;
  /** Local start/end Date for the occurrence. */
  start: Date;
  end: Date;
  /** yyyy-mm-dd of the occurrence day. */
  date: string;
  status: FrameworkOccurrenceStatus | null;
}

/** A resolved per-day label for one concrete date. */
export interface FrameworkDayLabelView {
  frameworkId: string;
  date: string; // yyyy-mm-dd
  label: string;
  color: string | null;
}
