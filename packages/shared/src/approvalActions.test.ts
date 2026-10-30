import { describe, expect, it } from "vitest";
import { undoApprovalPrompt } from "./approvalActions";

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
