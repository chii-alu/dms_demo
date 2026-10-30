import type { SupabaseClient } from "@supabase/supabase-js";

// Shared across server instances: counts live in Postgres (migration 20261030180000).
// Returns true while the caller is within `limit` hits per `windowSeconds`.
// Throws if the database cannot answer, so callers can refuse rather than let requests through unchecked.
export async function allowRequest(supabase: SupabaseClient, key: string, limit: number, windowSeconds = 60) {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return data === true;
}
