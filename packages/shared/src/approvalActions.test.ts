import { describe, expect, it } from "vitest";
import { approveTimePrompt, undoApprovalPrompt } from "./approvalActions";

describe("undoApprovalPrompt", () => {
  it("mentions the deduction when chore, reward and kid are known", () => {
    expect(undoApprovalPrompt("Dishes", 10, "Kid 1", "bucks")).toBe(
      'Undo approval for "Dishes"? This will deduct 10 bucks from Kid 1.',
    );
  });

  it("falls back to a generic prompt when details are missing", () => {
    expect(undoApprovalPrompt(undefined, undefined, undefined, "bucks")).toBe(
      'Undo approval for "this chore"?',
    );
  });
});

describe("approveTimePrompt", () => {
  it("is null for bucks-only approvals, even with a stale reward_minutes", () => {
    expect(approveTimePrompt([{ chore: { pay_mode: "bucks", reward: 5, reward_minutes: 30 }, kidName: "A" }])).toBeNull();
    expect(approveTimePrompt([{ chore: { reward: 5 } }, { chore: undefined }])).toBeNull();
  });

  it("names minutes and kid for a time chore", () => {
    const m = approveTimePrompt([{ chore: { name: "Dishes", pay_mode: "time", reward_minutes: 15 }, kidName: "Kid 1" }]);
    expect(m).toContain("15 min");
    expect(m).toContain("Kid 1");
    expect(m).toContain("can't be undone");
  });

  it("sums a mixed batch and skips bucks-only rows", () => {
    const m = approveTimePrompt([
      { chore: { name: "A", pay_mode: "time", reward_minutes: 10 }, kidName: "K1" },
      { chore: { name: "B", pay_mode: "both", reward: 3, reward_minutes: 5 }, kidName: "K2" },
      { chore: { name: "C", reward: 9 }, kidName: "K3" },
    ]);
    expect(m).toContain("15 min");
    expect(m).not.toContain("K3");
  });
});
