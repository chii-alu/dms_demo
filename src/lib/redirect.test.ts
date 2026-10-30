import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNext("/manage/registry")).toBe("/manage/registry");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNext("//evil.example")).toBe("/manage");
    expect(safeNext("https://evil.example")).toBe("/manage");
  });

  it("uses the fallback for empty input", () => {
    expect(safeNext("")).toBe("/manage");
    expect(safeNext("", "/dashboard")).toBe("/dashboard");
  });
});
