import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (cookiesToSet: Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => store.set({ name, value, ...options }));
          } catch {
            /* Server Component context: ignore */
          }
        },
      },
    },
  );
}
