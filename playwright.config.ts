import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: "pnpm dev", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: !process.env.CI, env: { AUTH_SECRET: "test-only-secret-that-is-long-enough-to-pass-validation", DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/skintech_test" } }
});

