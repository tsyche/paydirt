import { describe, expect, it } from "vitest";
import { goalTargetToGrit } from "./goalTarget";

describe("goalTargetToGrit", () => {
  it("passes Grit through as whole Grit, rounding up", () => {
    expect(goalTargetToGrit(40, "grit", 0)).toBe(40);
    expect(goalTargetToGrit(40.2, "grit", 0)).toBe(41);
  });
  it("converts dollars at the kid's rate and never undershoots", () => {
    expect(goalTargetToGrit(20, "dollars", 88)).toBe(1760);
    expect(goalTargetToGrit(12.5, "dollars", 3)).toBe(38); // 37.5 → 38
  });
  it("rejects bad input and dollars without a rate", () => {
    expect(goalTargetToGrit(10, "dollars", 0)).toBeNaN();
    expect(goalTargetToGrit(1.234, "dollars", 88)).toBeNaN();
    expect(goalTargetToGrit(0, "grit", 0)).toBeNaN();
    expect(goalTargetToGrit(-5, "dollars", 88)).toBeNaN();
  });
});
