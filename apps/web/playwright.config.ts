import { defineConfig } from "@playwright/test";

/**
 * Browser journeys against a running stack (web on :3000 → API on :4000 with seeded demo data).
 * Uses the locally installed Chrome by default; set PW_CHANNEL="" to use Playwright's bundled Chromium
 * (`pnpm exec playwright install chromium`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: true,
    locale: "sq-AL",
  },
});
