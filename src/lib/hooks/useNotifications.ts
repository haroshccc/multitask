import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/notifications";
import type { Notification } from "@/lib/types/domain";
import { useOrgScope } from "./useOrgScope";

export function useNotifications() {
  const scope = useOrgScope();
  return useQuery<Notification[]>({
    queryKey: queryKeys.notifications(scope.userId ?? ""),
    queryFn: () => service.listNotifications(scope.userId!),
    enabled: scope.enabled,
  });
}

export function useUnreadNotificationsCount() {
  const scope = useOrgScope();
  return useQuery<number>({
    queryKey: queryKeys.unreadNotificationsCount(scope.userId ?? ""),
    queryFn: () => service.unreadNotificationsCount(scope.userId!),
    enabled: scope.enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (notificationId: string) =>
      service.markNotificationRead(notificationId),
    onSuccess: () => {
      if (scope.userId) {
        qc.invalidateQueries({ queryKey: queryKeys.notifications(scope.userId) });
        qc.invalidateQueries({
          queryKey: queryKeys.unreadNotificationsCount(scope.userId),
        });
      }
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: () => service.markAllNotificationsRead(scope.userId!),
    onSuccess: () => {
      if (scope.userId) {
        qc.invalidateQueries({ queryKey: queryKeys.notifications(scope.userId) });
        qc.invalidateQueries({
          queryKey: queryKeys.unreadNotificationsCount(scope.userId),
        });
      }
    },
  });
}
