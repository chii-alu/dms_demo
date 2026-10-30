import { describe, expect, it } from "vitest";
import { needsAttention, type AttentionSession } from "./attention";

const TODAY = "2026-10-30";
const base: AttentionSession = {
  id: "s1",
  label: "HENT · Masterclass",
  selective: false,
  dates: ["2026-10-08"],
  applied: 0,
  eligible: 0,
  intakeStatus: "closed",
  feedbackStatus: "open",
  attendanceDates: new Set(),
};

describe("needsAttention", () => {
  it("flags applications waiting for review", () => {
    const items = needsAttention([{ ...base, selective: true, applied: 3, dates: ["2026-12-01"] }], TODAY);
    expect(items.map((i) => i.text)).toContain("3 applications waiting for review");
  });

  it("flags past dates with eligible people but no attendance", () => {
    const items = needsAttention([{ ...base, eligible: 5 }], TODAY);
    expect(items.map((i) => i.text)).toContain("Attendance not recorded for 2026-10-08");
  });

  it("does not flag a past date that has attendance, or a session with nobody eligible", () => {
    expect(needsAttention([{ ...base, eligible: 5, attendanceDates: new Set(["2026-10-08"]) }], TODAY)
      .filter((i) => i.tone === "bad")).toHaveLength(0);
    expect(needsAttention([{ ...base, eligible: 0 }], TODAY).filter((i) => i.tone === "bad")).toHaveLength(0);
  });

  it("flags a feedback form still in draft after the session", () => {
    const items = needsAttention([{ ...base, feedbackStatus: "draft" }], TODAY);
    expect(items.map((i) => i.text)).toContain("Feedback form not opened yet");
  });

  it("flags an intake form still in draft for an upcoming session", () => {
    const items = needsAttention([{ ...base, dates: ["2026-11-20"], intakeStatus: "draft" }], TODAY);
    expect(items.some((i) => i.text === "Registration form still in draft")).toBe(true);
  });

  it("links each item to the tab that resolves it", () => {
    const items = needsAttention([{ ...base, eligible: 1 }], TODAY);
    expect(items.find((i) => i.tone === "bad")?.tab).toBe("attendance");
  });
});
