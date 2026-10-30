// Which session tabs each role sees (SPEC §8). Reviewers only score applications, so they get that tab alone.
export type TabSlug = "forms" | "people" | "attendance" | "feedback" | "details";
export type StaffRole = "admin" | "pillar_lead" | "pillar_staff" | "reviewer";

export function visibleTabs(role: StaffRole | null): TabSlug[] {
  if (role === "reviewer") return ["people"];
  return ["forms", "people", "attendance", "feedback", "details"];
}

// Where a reviewer lands if they open a tab they cannot use.
export function fallbackTab(role: StaffRole | null): TabSlug {
  return role === "reviewer" ? "people" : "forms";
}
