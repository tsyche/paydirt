import { describe, expect, it } from "vitest";
import { choreLimit, isOverLimit, limitLabel, limitWindowDays } from "./choreLimit";

describe("chore limits", () => {
  it("derives the window from cadence, one-offs use a week", () => {
    expect(limitWindowDays({ type: "recurring", cadence: "daily" })).toBe(1);
    expect(limitWindowDays({ type: "recurring", cadence: "weekly" })).toBe(7);
    expect(limitWindowDays({ type: "recurring", cadence: "monthly" })).toBe(30);
    expect(limitWindowDays({ type: "recurring" })).toBe(1);
    expect(limitWindowDays({ type: "oneoff" })).toBe(7);
  });

  it("treats unset, zero, negative and fractional limits as no limit", () => {
    for (const v of [undefined, 0, -1, 1.5, NaN]) expect(choreLimit({ max_per_period: v })).toBe(0);
    expect(choreLimit({ max_per_period: 2 })).toBe(2);
  });

  it("flags only when the count has reached the limit", () => {
    const c = { type: "recurring", cadence: "daily", max_per_period: 1 };
    expect(isOverLimit(c, 0)).toBe(false);
    expect(isOverLimit(c, 1)).toBe(true);
    expect(isOverLimit({ max_per_period: 0 }, 99)).toBe(false);
  });

  it("labels the limit for chore rows", () => {
    expect(limitLabel({ type: "recurring", cadence: "daily", max_per_period: 1 })).toBe("1 per day");
    expect(limitLabel({ type: "oneoff", max_per_period: 2 })).toBe("2 per week");
    expect(limitLabel({ type: "recurring", cadence: "monthly", max_per_period: 1 })).toBe("1 per month");
    expect(limitLabel({ type: "oneoff" })).toBe("");
  });
});
