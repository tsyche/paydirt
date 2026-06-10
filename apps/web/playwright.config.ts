import { defineConfig } from "@playwright/test";

// E2E tests for the parent dashboard. Prerequisites: a running, seeded
// PocketBase (same as the shared package's integration tests — see README).
// The Next.js dev server is started automatically unless one is already up.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // Tests mutate the same seeded household — keep them sequential.
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
