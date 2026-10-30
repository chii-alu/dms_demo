import { describe, expect, it } from "vitest";
import { canEnterPortal, defaultPortal, inPortal, isPortal, landingPath, pillarsForPortal } from "./portals";

describe("portals", () => {
  it("admins can enter every portal, pillar staff only their own pillar", () => {
    expect(canEnterPortal("admin", "admin", [])).toBe(true);
    expect(canEnterPortal("hent", "admin", [])).toBe(true);
    expect(canEnterPortal("hent", "pillar_staff", ["HENT"])).toBe(true);
    expect(canEnterPortal("heco", "pillar_staff", ["HENT"])).toBe(false);
    expect(canEnterPortal("admin", "pillar_staff", ["HENT"])).toBe(false);
    expect(canEnterPortal("hent", "reviewer", [])).toBe(false);
  });

  it("shows all pillars for the admin portal and one pillar otherwise", () => {
    expect(pillarsForPortal("admin")).toEqual(["HENT", "HEMP", "HECO"]);
    expect(pillarsForPortal("hemp")).toEqual(["HEMP"]);
  });

  it("keeps records in their own portal, and everything in the admin portal", () => {
    expect(inPortal("admin", "HECO")).toBe(true);
    expect(inPortal("hent", "HENT")).toBe(true);
    expect(inPortal("hent", "HECO")).toBe(false);
  });

  it("lands admins in the admin portal and pillar staff in their first pillar", () => {
    expect(defaultPortal("admin", [])).toBe("admin");
    expect(defaultPortal("pillar_staff", ["HEMP", "HENT"])).toBe("hent");
    expect(defaultPortal("reviewer", [])).toBeNull();
  });

  it("recognises only the four portals", () => {
    expect(isPortal("hent")).toBe(true);
    expect(isPortal("HENT")).toBe(false);
    expect(isPortal("EXECUTIVE")).toBe(false);
    expect(isPortal(undefined)).toBe(false);
  });

  it("lands people in the view they chose unless they were sent to a specific page", () => {
    expect(landingPath("hent", "")).toBe("/manage/hent");
    expect(landingPath("hent", "/manage")).toBe("/manage/hent");
    expect(landingPath("hent", "/manage/hemp/registry")).toBe("/manage/hemp/registry");
  });
});
