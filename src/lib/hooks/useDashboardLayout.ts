import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/user-prefs";
import type {
  DashboardScreen,
  UserDashboardLayout,
  WidgetLayout,
  WidgetState,
} from "@/lib/types/domain";
import { useOrgScope } from "./useOrgScope";

export function useDashboardLayout(
  screenKey: DashboardScreen,
  scopeId?: string | null
) {
  const scope = useOrgScope();
  return useQuery<UserDashboardLayout | null>({
    queryKey: queryKeys.dashboardLayout(scope.userId ?? "", screenKey, scopeId),
    queryFn: () =>
      service.getDashboardLayout(scope.userId!, screenKey, scopeId ?? null),
    enabled: scope.enabled,
  });
}

export function useSaveDashboardLayout() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: (input: {
      screen_key: DashboardScreen;
      scope_id?: string | null;
      layout_desktop?: WidgetLayout;
      layout_tablet?: WidgetLayout;
      layout_mobile?: WidgetLayout;
      widget_state?: WidgetState;
    }) =>
      service.upsertDashboardLayout({
        user_id: scope.userId!,
        ...input,
      }),
    onSuccess: (data, vars) => {
      qc.setQueryData(
        queryKeys.dashboardLayout(scope.userId ?? "", vars.screen_key, vars.scope_id),
        data
      );
    },
  });
}

/**
 * Debounced auto-save hook — call `scheduleSave(next)` and it will persist
 * 500ms after the last call. Mirrors what react-grid-layout produces.
 */
export function useDebouncedLayoutSave(
  screenKey: DashboardScreen,
  scopeId?: string | null,
  delayMs = 500
) {
  const mutation = useSaveDashboardLayout();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleSave = (next: {
    layout_desktop?: WidgetLayout;
    layout_tablet?: WidgetLayout;
    layout_mobile?: WidgetLayout;
    widget_state?: WidgetState;
  }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      mutation.mutate({ screen_key: screenKey, scope_id: scopeId, ...next });
    }, delayMs);
  };

  return { scheduleSave, saving: mutation.isPending };
}
