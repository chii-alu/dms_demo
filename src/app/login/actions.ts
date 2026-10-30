"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";
import { canEnterPortal, isPortal, landingPath } from "@/lib/auth/portals";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const portal = String(formData.get("portal") ?? "");
  // Only the page they were sent to is kept on errors. The chosen view must not stick to the next attempt.
  const sentTo = String(formData.get("next") ?? "");
  const back = (error: string) =>
    `/login?error=${error}&portal=${encodeURIComponent(portal)}${sentTo ? `&next=${encodeURIComponent(sentTo)}` : ""}`;
  if (!isPortal(portal)) redirect(`/login?error=choose${sentTo ? `&next=${encodeURIComponent(sentTo)}` : ""}`);
  const next = safeNext(landingPath(portal, sentTo));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(back("invalid"));
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
    redirect(back("portal"));
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
