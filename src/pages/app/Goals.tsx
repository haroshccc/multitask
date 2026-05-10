import { useEffect, useMemo, useState } from "react";

import {
  Award,
  Clock,
  Columns3,
  CheckCircle2,
  Circle,
  Flag,
  Flame,
  LayoutGrid,
  Pencil,
  Plus,
  Repeat,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Eye,
  Lock,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTaskLists, useSharesForTaskLists } from "@/lib/hooks/useTaskLists";
import { useTaskSharesForTasks } from "@/lib/hooks/useTaskShares";
import { useTimeEntriesByRange } from "@/lib/hooks/useTimer";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import {
  computeGoalStats,
  periodLabelHe,
  periodUnitHe,
  type GoalPeriod,
} from "@/lib/goals/computation";
import type { Task, TimeEntry } from "@/lib/types/domain";
import { TaskEditModal, type TaskCreateDraft } from "@/components/tasks/TaskEditModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalTypeFilter = "all" | "achievement" | "habit";
type GoalLayout = "grid" | "columns";
type ScopeFilter = "all" | "mine" | "shared" | "others";

/** How the current user relates to this goal's sharing state */
type ShareKind =
  | "private"      // my goal, not shared with anyone
  | "mine-read"    // my goal, shared for view-only
  | "mine-write"   // my goal, shared for editing (collaborative)
  | "other-read"   // someone else's goal, I can only view
  | "other-write"; // someone else's goal, I can also mark completion

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LAYOUT_KEY = "multitask:goals:layout";
const TYPE_FILTER_KEY = "multitask:goals:typeFilter";
const SCOPE_FILTER_KEY = "multitask:goals:scopeFilter";

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

// PLACEHOLDER
