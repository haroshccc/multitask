import { createContext, useContext } from "react";
import type { DashboardRange } from "@/lib/hooks/useDateRange";

/**
 * Context shared between the dashboard page and all its widgets.
 * Widgets read the current range/view via `useDashboardRange()` instead of
 * each maintaining its own copy — keeps all panels in lockstep with the
 * top picker and the URL.
 */
export const DashboardRangeContext = createContext<DashboardRange | null>(null);

export function useDashboardRange(): DashboardRange {
  const ctx = useContext(DashboardRangeContext);
  if (!ctx) {
    throw new Error(
      "useDashboardRange must be used within DashboardRangeContext.Provider",
    );
  }
  return ctx;
}
