import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The native renderer has no component test harness. Guard section placement
// directly so grant history cannot bury actionable spend requests again.
describe("mobile approval layout", () => {
  it("opens settings with a fresh household snapshot and keeps bank labels adjacent", () => {
    const parent = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    expect(parent).toContain("household && hhSettingsOpen && (");
    const settings = readFileSync(new URL("../components/HouseholdSettings.tsx", import.meta.url), "utf8");
    const bank = settings.slice(settings.indexOf('<SettingLabel label="Bank threshold'));
    expect(bank).toMatch(/^<SettingLabel[^>]+\/>\s*<TextInput\s+keyboardType="numeric"\s+value=\{form.bank_threshold\}/);
  });

  it("shows an explicit add button and only removes the last window", () => {
    const source = readFileSync(new URL("../components/TimeField.tsx", import.meta.url), "utf8");
    expect(source).toContain('mode="outlined" icon="plus"');
    expect(source).toContain("index === rows.length - 1");
    expect(source).toContain("rows.slice(0, -1)");
    expect(source).toContain('value ? value.split(",") : []');
  });
  it("places spend requests before manual, queued, and historical grants", () => {
    const source = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    const spend = source.indexOf("{/* Spend requests */}");
    const grants = source.indexOf('(["manual", "queued"] as const)');
    const past = source.indexOf("<PastScreenGrants");
    const recent = source.indexOf("<RecentlyApproved");
    expect(spend).toBeGreaterThan(-1);
    expect(grants).toBeGreaterThan(spend);
    expect(past).toBeGreaterThan(grants);
    expect(recent).toBeGreaterThan(past);
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
    expect(source).not.toContain("Alert.prompt(");
    expect(source).toContain('label="What needs redone?"');
    expect(source).toContain("client.rejectAssignment(assignmentId, rejectionReason.trim())");
    expect(source).toContain("They will see this message.");
  });

  it("routes proposal approval through the create form prefill instead of an alert prompt", () => {
    const source = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    expect(source).toContain("function startProposalApprove");
    expect(source).toContain("function submitReasonDialog");
    expect(source).not.toContain("confirmApproveProposal");
    expect(source).not.toContain("Alert.prompt(");
  });

  it("prompts for a reason on proposal decline and spend deny", () => {
    const source = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    expect(source).toContain("client.declineProposal(id, user.id, reason)");
    expect(source).toContain("client.denySpendRequest(id, user.id, reason)");
  });
});
