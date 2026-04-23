import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { useOrgScope } from "./useOrgScope";

export interface GlobalSearchResult {
  entity_type: string;
  id: string;
  score: number;
  snippet: string;
  title: string;
}

async function globalSearch(
  organizationId: string,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("global_search", {
    p_organization_id: organizationId,
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as GlobalSearchResult[];
}

/**
 * Debounced global search — pass the raw user input; this hook handles
 * debouncing via React Query's `enabled` + the caller's own debouncing.
 * Expect callers to debounce the `query` string (~250ms) before passing here.
 */
export function useGlobalSearch(query: string, limit = 20) {
  const scope = useOrgScope();
  return useQuery<GlobalSearchResult[]>({
    queryKey: queryKeys.search(scope.organizationId ?? "", query),
    queryFn: () => globalSearch(scope.organizationId!, query, limit),
    enabled: scope.enabled && query.trim().length >= 2,
    staleTime: 30_000,
  });
}
