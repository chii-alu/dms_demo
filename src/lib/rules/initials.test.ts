import { describe, expect, it } from "vitest";
import { formCode, interventionInitials } from "./initials";

describe("interventionInitials", () => {
  it.each([
    ["Masterclass", "M"],
    ["Exposure & Networking", "EN"],
    ["Health Expert in Residence Programme", "HEIR"],
    ["Public Sector Innovation Hackathon", "PSIH"],
    ["SIE", "S"],
  ])("%s -> %s", (name, expected) => {
    expect(interventionInitials(name)).toBe(expected);
  });
});

describe("formCode", () => {
  it("follows {PILLAR}-{INITIALS}-{SEQ:000}-{SUFFIX}", () => {
    expect(formCode("HENT", "Masterclass", 4, "REG")).toBe("HENT-M-004-REG");
    expect(formCode("HECO", "Public Sector Fellowship", 12, "APP")).toBe("HECO-PSF-012-APP");
  });
});
