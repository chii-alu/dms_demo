import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManageNav, type NavPillar } from "@/components/manage/ManageNav";
import { signOut } from "@/app/login/actions";
import { PORTAL_COOKIE, PORTAL_LABEL, pillarsForPortal, resolvePortal } from "@/lib/auth/portals";

// Defence in depth: the proxy already checked the session. Here we check the
// staff role, and RLS limits what each query can return.
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staff } = await supabase.from("staff_roles").select("role, pillars").eq("user_id", user.id).maybeSingle();
  if (!staff) redirect("/login?error=no-access");

  // The portal chosen at sign-in, re-checked against the role on every request.
  const requested = (await cookies()).get(PORTAL_COOKIE)?.value;
  const portal = resolvePortal(requested, staff.role, staff.pillars ?? []);
  if (!portal) redirect("/login?error=no-access");
  const isAdmin = staff.role === "admin";
  const shownPillars = pillarsForPortal(portal);

  const { data: rows, error } = await supabase
    .from("interventions")
    .select("id, pillar, name, type, sessions(count)")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(`Could not load interventions: ${error.message}`);

  const pillars: NavPillar[] = shownPillars.map((pillar) => ({
    pillar,
    interventions: (rows ?? [])
      .filter((r) => r.pillar === pillar)
      .map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as "open" | "selective",
        sessionCount: (r.sessions as unknown as { count: number }[])[0]?.count ?? 0,
      })),
  }));

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[270px_1fr]">
      <aside className="border-b border-line bg-surface p-3 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:border-b-0 md:border-r">
        <ManageNav
          pillars={pillars}
          portalLabel={PORTAL_LABEL[portal]}
          signOutAction={signOut}
          isAdmin={isAdmin}
          showStaffAccess={isAdmin && portal === "admin"}
        />
      </aside>
      <main className="min-w-0 px-6 py-6 md:px-8">{children}</main>
    </div>
  );
}
