"use client";

import { createBrowserClient } from "@supabase/ssr";

function validUrl(raw: string | undefined): string {
  try {
    new URL(raw ?? "");
    return raw!;
  } catch {
    return "https://placeholder.supabase.co";
  }
}

const SUPABASE_URL = validUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith("ey")
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
