import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseConfig } from "./config";

describe("supabaseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the public URL and anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(supabaseConfig()).toEqual({ url: "http://127.0.0.1:54321", anonKey: "anon" });
  });

  it("fails loudly when configuration is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => supabaseConfig()).toThrow(/Copy .env.example to .env.local/);
  });
});
