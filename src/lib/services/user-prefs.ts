import { supabase } from "@/lib/supabase/client";
import type {
  DashboardScreen,
  FilterConfig,
  UserDashboardLayout,
  UserListVisibility,
  UserSavedFilter,
  WidgetLayout,
  WidgetState,
} from "@/lib/types/domain";

// Supabase represents "no scope" via a sentinel zero UUID (see DB constraint).
const NO_SCOPE_UUID = "00000000-0000-0000-0000-000000000000";

// Dashboard layouts ---------------------------------------------------------

export async function getDashboardLayout(
  userId: string,
  screenKey: DashboardScreen,
  scopeId?: string | null
): Promise<UserDashboardLayout | null> {
  const { data, error } = await supabase
    .from("user_dashboard_layouts")
    .select("*")
    .eq("user_id", userId)
    .eq("screen_key", screenKey)
    .eq("scope_id", scopeId ?? NO_SCOPE_UUID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertDashboardLayout(input: {
  user_id: string;
  screen_key: DashboardScreen;
  scope_id?: string | null;
  layout_desktop?: WidgetLayout;
  layout_tablet?: WidgetLayout;
  layout_mobile?: WidgetLayout;
  widget_state?: WidgetState;
}): Promise<UserDashboardLayout> {
  const { data, error } = await supabase
    .from("user_dashboard_layouts")
    .upsert(
      {
        user_id: input.user_id,
        screen_key: input.screen_key,
        scope_id: input.scope_id ?? NO_SCOPE_UUID,
        layout_desktop: (input.layout_desktop ?? []) as unknown as object,
        layout_tablet: (input.layout_tablet ?? []) as unknown as object,
        layout_mobile: (input.layout_mobile ?? []) as unknown as object,
        widget_state: (input.widget_state ?? {}) as unknown as object,
      },
      { onConflict: "user_id,screen_key,scope_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// List visibility (shown/hidden per screen) ---------------------------------

export async function getListVisibility(
  userId: string,
  screenKey: DashboardScreen
): Promise<UserListVisibility | null> {
  const { data, error } = await supabase
    .from("user_list_visibility")
    .select("*")
    .eq("user_id", userId)
    .eq("screen_key", screenKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertListVisibility(input: {
  user_id: string;
  screen_key: DashboardScreen;
  hidden_list_ids: string[];
}): Promise<UserListVisibility> {
  const { data, error } = await supabase
    .from("user_list_visibility")
    .upsert(input, { onConflict: "user_id,screen_key" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Saved filters -------------------------------------------------------------

export async function listSavedFilters(
  userId: string,
  screenKey: DashboardScreen
): Promise<UserSavedFilter[]> {
  const { data, error } = await supabase
    .from("user_saved_filters")
    .select("*")
    .eq("user_id", userId)
    .eq("screen_key", screenKey)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSavedFilter(input: {
  user_id: string;
  screen_key: DashboardScreen;
  name: string;
  filter_config: FilterConfig;
  is_default?: boolean;
}): Promise<UserSavedFilter> {
  const { data, error } = await supabase
    .from("user_saved_filters")
    .insert({
      ...input,
      filter_config: input.filter_config as unknown as object,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSavedFilter(
  filterId: string,
  patch: Partial<
    Pick<UserSavedFilter, "name" | "is_default" | "sort_order"> & {
      filter_config?: FilterConfig;
    }
  >
): Promise<UserSavedFilter> {
  const { data, error } = await supabase
    .from("user_saved_filters")
    .update({
      ...patch,
      filter_config: patch.filter_config
        ? (patch.filter_config as unknown as object)
        : undefined,
    })
    .eq("id", filterId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSavedFilter(filterId: string): Promise<void> {
  const { error } = await supabase
    .from("user_saved_filters")
    .delete()
    .eq("id", filterId);
  if (error) throw error;
}
