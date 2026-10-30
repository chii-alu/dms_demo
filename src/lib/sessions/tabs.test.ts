import { describe, expect, it } from "vitest";
import { fallbackTab, visibleTabs } from "./tabs";

describe("visibleTabs (SPEC §8)", () => {
  it("gives reviewers only the applications tab", () => {
    expect(visibleTabs("reviewer")).toEqual(["people"]);
    expect(visibleTabs("reviewer")).toEqual(["people"]);
  });
  it("gives staff every tab", () => {
    expect(visibleTabs("pillar_staff")).toEqual(["forms", "people", "attendance", "feedback", "details"]);
    expect(visibleTabs("admin")).toContain("details");
  });
  it("sends reviewers to the people tab when they open another one", () => {
    expect(fallbackTab("reviewer")).toBe("people");
    expect(fallbackTab("pillar_lead")).toBe("forms");
  });
});
