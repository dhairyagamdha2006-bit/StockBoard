import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * Server-scoped Supabase client (respects RLS via the user's session cookie).
 * No placeholder fallbacks — `getEnv()` throws loudly if the core env is invalid.
 */
export async function createClient() {
  const env = getEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {
          // Called from a Server Component — cookie writes are handled by proxy.
        }
      },
    },
  });
}

/**
 * Service-role client — BYPASSES RLS. Server-only (enforced by `server-only`).
 * Never import this module into a client component.
 */
export async function createServiceClient() {
  const env = getEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.");
  }
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
