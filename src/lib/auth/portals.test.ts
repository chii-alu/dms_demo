import { describe, expect, it } from "vitest";
import { canEnterPortal, isPortal, pillarsForPortal, resolvePortal } from "./portals";

describe("portals", () => {
  it("admins can enter every portal, pillar staff only their own pillar", () => {
    expect(canEnterPortal("admin", "admin", [])).toBe(true);
    expect(canEnterPortal("HENT", "admin", [])).toBe(true);
    expect(canEnterPortal("HENT", "pillar_staff", ["HENT"])).toBe(true);
    expect(canEnterPortal("HECO", "pillar_staff", ["HENT"])).toBe(false);
    expect(canEnterPortal("admin", "pillar_staff", ["HENT"])).toBe(false);
    expect(canEnterPortal("HENT", "reviewer", [])).toBe(false);
  });

  it("shows all pillars for the admin portal and one pillar otherwise", () => {
    expect(pillarsForPortal("admin")).toEqual(["HENT", "HEMP", "HECO"]);
    expect(pillarsForPortal("HEMP")).toEqual(["HEMP"]);
  });

  it("uses the requested portal only when the person may enter it", () => {
    expect(resolvePortal("HECO", "admin", [])).toBe("HECO");
    expect(resolvePortal("HECO", "pillar_staff", ["HENT"])).toBe("HENT");
    expect(resolvePortal(undefined, "admin", [])).toBe("admin");
    expect(resolvePortal("admin", "pillar_staff", ["HEMP", "HENT"])).toBe("HENT");
    expect(resolvePortal(undefined, "reviewer", [])).toBeNull();
  });

  it("recognises only the four portals", () => {
    expect(isPortal("HENT")).toBe(true);
    expect(isPortal("EXECUTIVE")).toBe(false);
    expect(isPortal(undefined)).toBe(false);
  });
});
