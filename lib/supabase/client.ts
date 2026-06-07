"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client — memoized singleton.
 *
 * Creating a fresh client on every render (or every hook call) spins up new
 * realtime connections and breaks `===` identity in effect deps, causing
 * duplicate subscriptions. We create it once and reuse it.
 *
 * No placeholder fallbacks: if the public env is missing we throw a clear error
 * the first time a client is requested (never at module load, so the landing
 * page and build are unaffected).
 */
let browserClient: SupabaseClient | null = null;

function readPublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example."
    );
  }
  try {
    new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  return { url, anonKey };
}

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, anonKey } = readPublicEnv();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
