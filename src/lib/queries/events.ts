import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { EventInsert, EventRow, EventUpdate } from "@/lib/types/domain";

export const eventKeys = {
  all: ["events"] as const,
  range: (orgId: string, from: string, to: string) =>
    ["events", orgId, "range", from, to] as const,
};

export function useEventsInRange(
  orgId: string | null,
  fromIso: string,
  toIso: string
) {
  return useQuery({
    queryKey: eventKeys.range(orgId ?? "none", fromIso, toIso),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organization_id", orgId!)
        .lt("starts_at", toIso)
        .gte("ends_at", fromIso)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface CreateEventInput {
  orgId: string;
  ownerId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  description?: string;
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: ["events", "detail", id ?? "none"] as const,
    enabled: Boolean(id),
    queryFn: async (): Promise<EventRow | null> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: EventUpdate }) => {
      const { error } = await supabase.from("events").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      ownerId,
      title,
      startsAt,
      endsAt,
      allDay,
      description,
    }: CreateEventInput): Promise<EventRow> => {
      const insert: EventInsert = {
        organization_id: orgId,
        owner_id: ownerId,
        title,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDay ?? false,
        description: description ?? null,
      };
      const { data, error } = await supabase
        .from("events")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
