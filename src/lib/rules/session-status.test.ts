import { describe, expect, it } from "vitest";
import { sessionStatus } from "./session-status";

const TODAY = "2026-10-30";

describe("sessionStatus (SPEC §4.1)", () => {
  it("is Completed when every date is past", () => {
    expect(sessionStatus(["2026-09-01", "2026-10-29"], TODAY)).toBe("Completed");
  });
  it("is Upcoming when the first date is in the future", () => {
    expect(sessionStatus(["2026-11-01", "2026-11-02"], TODAY)).toBe("Upcoming");
  });
  it("is In progress otherwise, including a date today", () => {
    expect(sessionStatus(["2026-10-01", "2026-10-30"], TODAY)).toBe("In progress");
    expect(sessionStatus(["2026-10-30"], TODAY)).toBe("In progress");
  });
  it("is Not scheduled without dates", () => {
    expect(sessionStatus([], TODAY)).toBe("Not scheduled");
  });
  it("sorts dates before comparing", () => {
    expect(sessionStatus(["2026-11-02", "2026-10-01"], TODAY)).toBe("In progress");
  });
});
