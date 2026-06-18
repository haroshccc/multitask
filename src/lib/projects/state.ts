import type { Project, ProjectUpdate } from "@/lib/types/domain";

/**
 * The unified, user-facing project state — a single three-way control that
 * replaces the old boolean active/inactive toggle. It is derived from two
 * underlying columns:
 *   - `status === "completed"`  → "completed"
 *   - `is_active === false`     → "inactive"  (hidden from tasks + calendar)
 *   - otherwise                 → "active"
 *
 * `completed` keeps `is_active = true` (a finished project still shows up; use
 * "inactive" to actually hide its work), so the three states are mutually
 * exclusive through {@link projectStatePatch}.
 */
export type ProjectState = "active" | "inactive" | "completed";

export const PROJECT_STATE_LABEL: Record<ProjectState, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  completed: "הושלם",
};

export const PROJECT_STATE_ORDER: ProjectState[] = [
  "active",
  "inactive",
  "completed",
];

export function getProjectState(
  p: Pick<Project, "status" | "is_active">
): ProjectState {
  if (p.status === "completed") return "completed";
  if (p.is_active === false) return "inactive";
  return "active";
}

export function projectStatePatch(state: ProjectState): ProjectUpdate {
  switch (state) {
    case "completed":
      return { status: "completed", is_active: true };
    case "inactive":
      return { status: "active", is_active: false };
    case "active":
    default:
      return { status: "active", is_active: true };
  }
}
