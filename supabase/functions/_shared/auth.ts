// JWT verification + active-org membership check for Edge Functions.
// Pattern: every storage endpoint MUST call requireMember(req) before doing
// anything else. If the request is anonymous or the user isn't in any active
// organization, returns a 401/403 response that the caller should bail on.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { jsonResponse } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type MembershipContext = {
  userId: string;
  organizationId: string;
  role: string;
  /** Service-role client — bypasses RLS. Use for Edge-Function internal writes. */
  serviceClient: SupabaseClient;
};

export async function requireMember(
  req: Request
): Promise<{ ctx: MembershipContext } | { error: Response }> {
  const auth = req.headers.get("authorization");
  const origin = req.headers.get("origin");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { error: jsonResponse({ error: "missing_auth" }, { status: 401, origin }) };
  }
  const jwt = auth.slice(7);

  // Verify the JWT against Supabase Auth.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return { error: jsonResponse({ error: "invalid_jwt" }, { status: 401, origin }) };
  }

  // Service client bypasses RLS — used to look up membership and to write
  // recording rows on behalf of the user with the correct organization_id.
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: membership, error: memErr } = await serviceClient
    .from("organization_members")
    .select("organization_id, role, organizations!inner(is_archived)")
    .eq("user_id", userData.user.id)
    .eq("organizations.is_archived", false)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr || !membership) {
    return { error: jsonResponse({ error: "no_active_org" }, { status: 403, origin }) };
  }

  return {
    ctx: {
      userId: userData.user.id,
      organizationId: membership.organization_id,
      role: membership.role,
      serviceClient,
    },
  };
}
