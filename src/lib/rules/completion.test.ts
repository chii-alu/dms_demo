import { describe, expect, it } from "vitest";
import { isCompleted } from "./completion";
import { average, netPromoterScore } from "./feedback";

describe("isCompleted (SPEC §4.14)", () => {
  it("needs attended ≥ threshold × dates", () => {
    expect(isCompleted(3, 3, 0.75)).toBe(true);
    expect(isCompleted(2, 3, 0.75)).toBe(false); // 2 < 2.25
    expect(isCompleted(1, 1, 0.75)).toBe(true);
  });
  it("is never complete without dates", () => {
    expect(isCompleted(0, 0, 0.75)).toBe(false);
  });
});

describe("feedback summary", () => {
  it("computes NPS as promoters minus detractors", () => {
    expect(netPromoterScore([10, 9, 8, 6])).toBe(25); // 2 promoters, 1 detractor, 4 responses
    expect(netPromoterScore([])).toBe(0);
  });
  it("averages ratings", () => {
    expect(average([3, 4, 5])).toBe(4);
    expect(average([])).toBe(0);
  });
});
