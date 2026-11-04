import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The native renderer has no component test harness. Guard section placement
// directly so grant history cannot bury actionable spend requests again.
describe("mobile approval layout", () => {
  it("places spend requests before manual, queued, and historical grants", () => {
    const source = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    const spend = source.indexOf("{/* Spend requests */}");
    const grants = source.indexOf('(["manual", "queued", "history"] as const)');
    const recent = source.indexOf("<RecentlyApproved");
    expect(spend).toBeGreaterThan(-1);
    expect(grants).toBeGreaterThan(spend);
    expect(recent).toBeGreaterThan(grants);
  });
});
