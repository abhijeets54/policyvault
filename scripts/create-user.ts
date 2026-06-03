/* eslint-disable no-console */
/**
 * Admin helper: create a user (agent) with email + password.
 * Usage:  npm run create-user -- agent@example.com 'StrongPassword!'
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run create-user -- <email> <password>");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Missing SUPABASE env vars"); process.exit(1); }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) { console.error(error.message); process.exit(1); }
  console.log("Created user:", data.user?.id, data.user?.email);
}
main();
