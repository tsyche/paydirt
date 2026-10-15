import { defineConfig } from "@playwright/test";

// E2E tests for the parent dashboard. Prerequisites: a running, seeded
// PocketBase (same as the shared package's integration tests — see README).
// The Next.js dev server is started automatically unless one is already up.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // Tests mutate the same seeded household — keep them sequential.
  workers: 1,
  // One CI retry classifies a test as flaky without hiding stateful failures.
  retries: process.env.CI ? 1 : 0,
  // CI also writes a JSON report; Playwright marks a retried pass as "flaky".
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "e2e-results/report.json" }]]
    : [["list"]],
  use: {
    baseURL: "http://localhost:3110",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3110",
    // Never reuse: a dev server on this port points at the dev PocketBase, not the test one.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
