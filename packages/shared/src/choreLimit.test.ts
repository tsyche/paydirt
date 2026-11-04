import { describe, expect, it } from "vitest";
import { choreLimit, isOverLimit, kidsAtLimit, limitLabel, limitWindowDays } from "./choreLimit";
import { localDateInstant } from "./dates";

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

describe("kidsAtLimit", () => {
  it("resets daily limits at midnight even if yesterday's chore was assigned late", () => {
    const now = new Date(localDateInstant("2026-11-04T00:01")).getTime();
    const chore = { id: "daily", type: "recurring", cadence: "daily", max_per_period: 1 };
    const yesterday = localDateInstant("2026-11-03T23:30");
    const midnight = localDateInstant("2026-11-04");
    expect(kidsAtLimit(chore, [{ chore: "daily", child: "kid", created: yesterday }], now).size).toBe(0);
    expect(kidsAtLimit(chore, [{ chore: "daily", child: "kid", created: midnight }], now).get("kid")).toBe(1);
  });
  const now = Date.parse("2026-11-01T12:00:00Z");
  const daily = { id: "c1", type: "recurring", cadence: "daily", max_per_period: 1 };
  const row = (chore: string, child: string, created: string) => ({ chore, child, created });

  it("flags kids with a row inside the window, not older ones or other chores", () => {
    const rows = [
      row("c1", "kidA", "2026-11-01 08:00:00.000Z"),
      row("c1", "kidB", "2026-10-30 08:00:00.000Z"), // outside the 1-day window
      row("c2", "kidB", "2026-11-01 08:00:00.000Z"), // different chore
    ];
    expect([...kidsAtLimit(daily, rows, now).keys()]).toEqual(["kidA"]);
  });

  it("needs the full count when the limit is above 1", () => {
    const c = { ...daily, max_per_period: 2 };
    const one = [row("c1", "kidA", "2026-11-01 08:00:00.000Z")];
    expect(kidsAtLimit(c, one, now).size).toBe(0);
    expect(kidsAtLimit(c, [...one, ...one], now).get("kidA")).toBe(2);
  });

  it("is empty when the chore has no limit", () => {
    expect(kidsAtLimit({ id: "c1", type: "oneoff" }, [row("c1", "kidA", "2026-11-01 08:00:00.000Z")], now).size).toBe(0);
  });
});
