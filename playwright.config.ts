import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Set E2E_BASE_URL to test a running deployment or dev server. Then no local server is started.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // SPEC §11: public forms must work on a 360 px wide phone (Chromium emulation).
    {
      name: "phone-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        env: {
          // Placeholder values: the smoke tests never reach Supabase.
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
        },
      },
});
