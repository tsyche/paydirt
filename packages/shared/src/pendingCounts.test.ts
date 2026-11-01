import { describe, expect, it } from "vitest";
import { waitingActionCount } from "./pendingCounts";

const empty = { approvals: [], spend: [], proposals: [], screenGrants: [], bonusGrants: [] };

describe("waitingActionCount", () => {
  it("is 0 when nothing waits", () => {
    expect(waitingActionCount(empty)).toBe(0);
  });
  it("counts approvals, spend requests and chore ideas", () => {
    expect(waitingActionCount({ ...empty, approvals: [1, 2], spend: [1], proposals: [1] })).toBe(4);
  });
  it("counts only manual grants, not queued, granted or manual_done", () => {
    const grants = [{ grant_status: "manual" }, { grant_status: "queued" }, { grant_status: "granted" }, { grant_status: "manual_done" }, {}];
    expect(waitingActionCount({ ...empty, screenGrants: grants, bonusGrants: [{ grant_status: "manual" }] })).toBe(2);
  });
});
