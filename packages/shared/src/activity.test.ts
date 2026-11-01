import { describe, expect, it } from "vitest";
import { streakPeak, summarizeMonthActivity } from "./activity";

const a = (d?: string) => ({ approved_at: d });

describe("streakPeak", () => {
  it("returns 0 with no approved dates", () => {
    expect(streakPeak([])).toBe(0);
    expect(streakPeak([a(undefined), a("")])).toBe(0);
  });
  it("finds the longest consecutive run, ignoring duplicates and order", () => {
    const list = [a("2026-10-05 08:00:00"), a("2026-10-03 09:00:00"), a("2026-10-04 10:00:00"), a("2026-10-04 11:00:00"), a("2026-10-09 07:00:00"), a("2026-10-10 07:00:00")];
    expect(streakPeak(list)).toBe(3);
  });
  it("counts a gap day as a break", () => {
    expect(streakPeak([a("2026-10-01"), a("2026-10-03")])).toBe(1);
  });
});

describe("summarizeMonthActivity", () => {
  it("splits earned and spent and counts chores", () => {
    const r = summarizeMonthActivity([{ amount: 10 }, { amount: -4 }, { amount: 5 }, { amount: -1 }], [a("2026-10-01"), a("2026-10-02")]);
    expect(r).toEqual({ chores: 2, earned: 15, spent: 5, peak: 2 });
  });
  it("is all zeros for an empty month", () => {
    expect(summarizeMonthActivity([], [])).toEqual({ chores: 0, earned: 0, spent: 0, peak: 0 });
  });
});
