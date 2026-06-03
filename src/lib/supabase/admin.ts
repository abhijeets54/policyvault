import { createClient } from "@supabase/supabase-js";

// Service-role client factory. Server-only. Bypasses RLS — use with care.
// Per official Supabase + Next.js docs: NEVER create clients at module level.
// Always call createAdminClient() inside an async function / request handler.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
