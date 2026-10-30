"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

// Use only in Client Components. Most data reads happen on the server.
export function createClient() {
  const { url, anonKey } = supabaseConfig();
  return createBrowserClient(url, anonKey);
}
