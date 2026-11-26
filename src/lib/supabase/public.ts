import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";

/** Anon client without cookies — safe for public catalog reads and ISR. */
export function isPublicSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) return false;
  if (url.includes("placeholder")) return false;
  return true;
}

/**
 * GET/HEAD catalog reads participate in the Next data cache (60s).
 * Unconfigured environments fail immediately instead of dialing a placeholder host.
 * Mutations are not cached.
 */
const publicFetch: typeof fetch = (input, init) => {
  if (!isPublicSupabaseConfigured()) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: "supabase_unconfigured", code: "503" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return fetch(input, init);
  }
  return fetch(input, {
    ...init,
    cache: "force-cache",
    next: { revalidate: 60 },
  } as RequestInit);
};

export function createPublicClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || PLACEHOLDER_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: publicFetch },
  });
}
