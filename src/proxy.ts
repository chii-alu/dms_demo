import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 name for middleware. Refreshes the session and sends signed-out
// visitors to /login before any staff or dashboard page renders.
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/manage/:path*", "/dashboard/:path*"],
};
