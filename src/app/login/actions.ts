"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";
import { PORTAL_COOKIE, canEnterPortal, isPortal } from "@/lib/auth/portals";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/manage"));
  const portal = String(formData.get("portal") ?? "");

  if (!isPortal(portal)) {
    redirect(`/login?error=portal&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=invalid&portal=${portal}&next=${encodeURIComponent(next)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: staff } = user
    ? await supabase.from("staff_roles").select("role, pillars").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!staff) redirect("/login?error=no-access");

  if (!canEnterPortal(portal, staff.role, staff.pillars ?? [])) {
    await supabase.auth.signOut();
    redirect(`/login?error=portal&portal=${portal}&next=${encodeURIComponent(next)}`);
  }

  const jar = await cookies();
  jar.set(PORTAL_COOKIE, portal, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(PORTAL_COOKIE);
  redirect("/login");
}
