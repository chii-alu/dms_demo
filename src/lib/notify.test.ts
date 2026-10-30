import { describe, expect, it } from "vitest";
import { notifyText } from "./notify";

const base = {
  firstName: "Aline",
  pid: "MELA-0007",
  sessionTitle: "Climate-tech Hackathon",
  interventionName: "Hackathon",
  pillar: "HENT",
  datesText: "20 Nov 2026",
  venue: "Kigali Innovation City",
  deadline: "6 Nov 2026",
};

describe("notifyText", () => {
  it("greets by first name, includes the participant ID and signs off with the pillar", () => {
    const t = notifyText({ ...base, status: "selected" });
    expect(t.startsWith("Dear Aline,")).toBe(true);
    expect(t).toContain("Your participant ID is MELA-0007.");
    expect(t.endsWith("HENT team")).toBe(true);
  });

  it("uses the registration wording for a registered status", () => {
    expect(notifyText({ ...base, status: "registered" })).toContain("at Kigali Innovation City");
  });
});
