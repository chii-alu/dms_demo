// Portals are the views a signed-in person picks at sign-in: the whole manager for admins,
// or one pillar for pillar staff. The choice is a view, not a security boundary: RLS still limits the data.
export const PORTALS = ["admin", "HECO", "HEMP", "HENT"] as const;
export type Portal = (typeof PORTALS)[number];
export type PortalPillar = "HENT" | "HEMP" | "HECO";

export const PORTAL_COOKIE = "mela_portal";
export const PORTAL_LABEL: Record<Portal, string> = { admin: "Admin", HECO: "HECO", HEMP: "HEMP", HENT: "HENT" };

const PILLAR_ORDER: PortalPillar[] = ["HENT", "HEMP", "HECO"];

export function isPortal(value: unknown): value is Portal {
  return typeof value === "string" && (PORTALS as readonly string[]).includes(value);
}

export function canEnterPortal(portal: Portal, role: string | null, pillars: string[]): boolean {
  if (role === "admin") return true;
  if (portal === "admin") return false;
  return pillars.includes(portal);
}

// Which pillars a portal shows in the navigation.
export function pillarsForPortal(portal: Portal): PortalPillar[] {
  return portal === "admin" ? PILLAR_ORDER : [portal];
}

// The portal to use for this request: the one in the cookie if the person may still enter it,
// otherwise their default (admin for admins, their first pillar for pillar staff), or null if they have none.
export function resolvePortal(requested: string | undefined, role: string | null, pillars: string[]): Portal | null {
  if (isPortal(requested) && canEnterPortal(requested, role, pillars)) return requested;
  if (role === "admin") return "admin";
  const first = PILLAR_ORDER.find((p) => pillars.includes(p));
  return first ?? null;
}
