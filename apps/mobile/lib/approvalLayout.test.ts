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

  it("keeps approve and reject together, with partial credit on its own row", () => {
    const source = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    const actions = source.indexOf("<View style={styles.approvalActions}>");
    const primary = source.indexOf("<View style={styles.approvalPrimaryActions}>", actions);
    const partial = source.indexOf("<PartialCredit", actions);
    expect(primary).toBeGreaterThan(actions);
    expect(partial).toBeGreaterThan(primary);
  });

  it("hides chore instructions until More details is pressed", () => {
    const source = readFileSync(new URL("../components/ChoreNotes.tsx", import.meta.url), "utf8");
    expect(source).toContain('{expanded && <Text variant="bodySmall"');
    expect(source).toContain('{expanded ? "Less details" : "More details"}');
  });

  it("uses a cross-platform reason dialog when sending a chore back", () => {
    const source = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    const rejection = source.slice(
      source.indexOf("function confirmReject"),
      source.indexOf("function confirmApproveProposal"),
    );
    expect(rejection).not.toContain("Alert.prompt(");
    expect(source).toContain('label="What needs redone?"');
    expect(source).toContain("client.rejectAssignment(assignmentId, rejectionReason.trim())");
    expect(source).toContain("They will see this message.");
  });
});
