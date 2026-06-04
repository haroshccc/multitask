import type { AssistantSkill } from "@/lib/ai/types";
import { useFoodSkill } from "@/lib/ai/skills/food-skill";

/**
 * Maps the current route to the active assistant skill. MVP: only the food
 * skill, active on /app/food. Phase 2 registers more skills here (and the
 * panel can offer a general fallback skill on other screens).
 *
 * Returns null when no skill is registered for the current path — the panel
 * shows a "not available here yet" state.
 */
export function useActiveSkill(pathname: string): AssistantSkill | null {
  // Hooks must run unconditionally, so build every skill and pick by route.
  const foodSkill = useFoodSkill();

  if (pathname.startsWith("/app/food")) return foodSkill;
  return null;
}
