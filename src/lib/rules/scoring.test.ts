import { describe, expect, it } from "vitest";
import { applicationScore, reviewerScore } from "./scoring";

const criteria = [
  { id: "a", weight: 30 },
  { id: "b", weight: 30 },
  { id: "c", weight: 40 },
];

describe("reviewerScore (SPEC §4.13)", () => {
  it("applies the weighted formula", () => {
    // 4/5*30 + 5/5*30 + 3/5*40 = 24 + 30 + 24 = 78
    expect(reviewerScore(criteria, { a: 4, b: 5, c: 3 })).toBe(78);
  });

  it("is 100 for all fives and 20 for all ones", () => {
    expect(reviewerScore(criteria, { a: 5, b: 5, c: 5 })).toBe(100);
    expect(reviewerScore(criteria, { a: 1, b: 1, c: 1 })).toBe(20);
  });

  it("is null until every criterion is scored", () => {
    expect(reviewerScore(criteria, { a: 5, b: 5 })).toBeNull();
  });

  it("normalises by the weight total when weights do not add to 100", () => {
    expect(reviewerScore([{ id: "x", weight: 20 }, { id: "y", weight: 20 }], { x: 5, y: 3 })).toBe(80);
  });
});

describe("applicationScore (averaged across reviewers)", () => {
  it("averages the reviewers who scored everything", () => {
    const s = applicationScore(criteria, {
      alice: { a: 4, b: 5, c: 3 }, // 78
      ben: { a: 5, b: 5, c: 5 }, // 100
      cara: { a: 2 }, // incomplete, ignored
    });
    expect(s).toBe(89);
  });

  it("is null when nobody has scored every criterion", () => {
    expect(applicationScore(criteria, { alice: { a: 4 } })).toBeNull();
    expect(applicationScore(criteria, {})).toBeNull();
  });
});
