import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

// Refreshes the Supabase session cookie on every matched request and returns
// the signed-in user (or null). Called from src/proxy.ts.
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = supabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run other code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
