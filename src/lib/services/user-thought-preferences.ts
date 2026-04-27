import { supabase } from "@/lib/supabase/client";

export interface UserThoughtPreferences {
  user_id: string;
  auto_transcribe_recorded_thoughts: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULTS = {
  auto_transcribe_recorded_thoughts: false,
} as const;

/**
 * Returns the row if present, or a defaults object if the user hasn't toggled
 * any preferences yet. Callers can treat the response uniformly.
 */
export async function getUserThoughtPreferences(
  userId: string
): Promise<UserThoughtPreferences> {
  const { data, error } = await supabase
    .from("user_thought_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as UserThoughtPreferences;
  const now = new Date().toISOString();
  return { user_id: userId, ...DEFAULTS, created_at: now, updated_at: now };
}

export async function upsertUserThoughtPreferences(
  userId: string,
  patch: Partial<Pick<UserThoughtPreferences, "auto_transcribe_recorded_thoughts">>
): Promise<UserThoughtPreferences> {
  const { data, error } = await supabase
    .from("user_thought_preferences")
    .upsert(
      { user_id: userId, ...patch },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as UserThoughtPreferences;
}
