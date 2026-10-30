import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header and rows, quoting fields that need it", () => {
    const out = toCsv(["name", "note"], [
      { name: "Aline", note: "plain" },
      { name: "Kofi, Jr", note: 'said "hi"\nthen left' },
    ]);
    expect(out).toBe('name,note\r\nAline,plain\r\n"Kofi, Jr","said ""hi""\nthen left"\r\n');
  });

  it("leaves nulls empty and serialises objects as JSON", () => {
    expect(toCsv(["a", "b"], [{ a: null, b: { x: 1 } }])).toBe('a,b\r\n,"{""x"":1}"\r\n');
  });
});
