// Portals are the separate addresses of the tracker: /manage/admin for the whole MELA view,
// and /manage/hent, /manage/hemp, /manage/heco for one pillar each. Admins can open every portal.
// The address only chooses the view. RLS still decides what data comes back.
export const PORTALS = ["admin", "heco", "hemp", "hent"] as const;
export type Portal = (typeof PORTALS)[number];
export type PortalPillar = "HENT" | "HEMP" | "HECO";

export const PORTAL_LABEL: Record<Portal, string> = { admin: "Admin", heco: "HECO", hemp: "HEMP", hent: "HENT" };

const PILLAR_OF: Record<Exclude<Portal, "admin">, PortalPillar> = { heco: "HECO", hemp: "HEMP", hent: "HENT" };
const PORTAL_OF: Record<PortalPillar, Exclude<Portal, "admin">> = { HECO: "heco", HEMP: "hemp", HENT: "hent" };
const PILLAR_ORDER: PortalPillar[] = ["HENT", "HEMP", "HECO"];

export function isPortal(value: unknown): value is Portal {
  return typeof value === "string" && (PORTALS as readonly string[]).includes(value);
}

export function canEnterPortal(portal: Portal, role: string | null, pillars: string[]): boolean {
  if (role === "admin") return true;
  if (portal === "admin") return false;
  return pillars.includes(PILLAR_OF[portal]);
}

// Which pillars a portal shows.
export function pillarsForPortal(portal: Portal): PortalPillar[] {
  return portal === "admin" ? PILLAR_ORDER : [PILLAR_OF[portal]];
}

// Whether a record in this pillar belongs in this portal.
export function inPortal(portal: string, pillar: string): boolean {
  if (portal === "admin") return true;
  return isPortal(portal) && portal !== "admin" && PILLAR_OF[portal] === pillar;
}

// The portal a person lands in: admin for admins, otherwise their first pillar. Null if they have neither.
export function defaultPortal(role: string | null, pillars: string[]): Portal | null {
  if (role === "admin") return "admin";
  const first = PILLAR_ORDER.find((p) => pillars.includes(p));
  return first ? PORTAL_OF[first] : null;
}

// Where a person goes after signing in: the page they were sent to, or else the view they chose.
export function landingPath(portal: Portal, requested: string): string {
  return requested && requested !== "/manage" ? requested : `/manage/${portal}`;
}
