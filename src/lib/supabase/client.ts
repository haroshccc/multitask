import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment. " +
      "Copy .env.example to .env.local and fill in the values."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disabled: we do the code exchange explicitly in AuthCallback so we can
    // observe success/error deterministically (see src/pages/AuthCallback.tsx).
    detectSessionInUrl: false,
    flowType: "pkce",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type SupabaseClient = typeof supabase;
