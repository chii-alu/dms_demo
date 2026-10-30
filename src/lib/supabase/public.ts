import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

// Anonymous client for public forms: no cookies, no session. Access is limited to the public RPCs.
export function createPublicClient() {
  const { url, anonKey } = supabaseConfig();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
