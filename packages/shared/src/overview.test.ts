import { describe, expect, it } from "vitest";
import {
  addSummaries, bankView, bucksToMinutes, occurrencesPerWeek, pctChange, periodRange, summarizePeriod,
  toDollars, weeklyPotential,
} from "./overview";

describe("bankView", () => {
  it("converts to dollars and floors minutes to the 5-minute step", () => {
    expect(bankView(176, 88, 0.6)).toEqual({ dollars: 2, screenMinutes: 290 });
    expect(bankView(2, 88, 0.6).screenMinutes).toBe(0); // below one 5-minute block
  });
  it("hides dollars at goods rate 0 and minutes at screen rate 0", () => {
    expect(bankView(50, 0, 0)).toEqual({ dollars: null, screenMinutes: 0 });
    expect(toDollars(10, 0)).toBeNull();
    expect(bucksToMinutes(-5, 1)).toBe(0);
  });
});

describe("weeklyPotential", () => {
  const daily = { type: "recurring", cadence: "daily", reward: 3 } as const;
  it("counts occurrences per week from cadence", () => {
    expect(occurrencesPerWeek(daily)).toBe(7);
    expect(occurrencesPerWeek({ type: "recurring", cadence: "weekly", reward: 1 })).toBe(1);
    expect(occurrencesPerWeek({ type: "oneoff", reward: 1 })).toBe(0);
  });
  it("caps by max_per_period converted to a week", () => {
    expect(occurrencesPerWeek({ ...daily, max_per_period: 1 })).toBe(7); // 1/day = 7/week
    expect(occurrencesPerWeek({ type: "recurring", cadence: "daily", reward: 3, max_per_period: 0 })).toBe(7);
    expect(occurrencesPerWeek({ type: "recurring", cadence: "weekly", reward: 3, max_per_period: 3 })).toBe(1);
    expect(occurrencesPerWeek({ type: "recurring", cadence: "monthly", reward: 3, max_per_period: 2 })).toBeCloseTo(7 / 30);
  });
  it("splits bucks from bonus minutes and leaves one-offs out", () => {
    const p = weeklyPotential(
      [
        daily,
        { type: "recurring", cadence: "weekly", reward: 5, reward_minutes: 15, pay_mode: "both" },
        { type: "recurring", cadence: "weekly", reward: 99, reward_minutes: 10, pay_mode: "time" },
        { type: "oneoff", reward: 50 },
      ],
      88,
      0.6,
    );
    expect(p).toMatchObject({ chores: 3, oneOffs: 1, bucks: 26, bonusMinutes: 25 });
    expect(p.dollars).toBeCloseTo(26 / 88);
    expect(p.screenMinutes).toBe(40); // 26 / 0.6 = 43 -> 40
  });
});

describe("periodRange", () => {
  const now = new Date(2026, 10, 4); // Wed 4 Nov 2026
  it("week starts Monday", () => {
    expect(periodRange("week", now)).toMatchObject({ start: "2026-11-02", end: "2026-11-09" });
    expect(periodRange("week", now, -1)).toMatchObject({ start: "2026-10-26", end: "2026-11-02" });
  });
  it("month and year, with offsets across boundaries", () => {
    expect(periodRange("month", now)).toMatchObject({ start: "2026-11-01", end: "2026-12-01", label: "2026-11" });
    expect(periodRange("month", now, 2)).toMatchObject({ start: "2027-01-01", end: "2027-02-01" });
    expect(periodRange("year", now, -1)).toMatchObject({ start: "2025-01-01", end: "2026-01-01", label: "2025" });
  });
  it("Sunday belongs to the week that started the previous Monday", () => {
    expect(periodRange("week", new Date(2026, 10, 8)).start).toBe("2026-11-02");
  });
});

describe("summarizePeriod", () => {
  it("separates earned, spent and parent adjustments; sums time-chore minutes", () => {
    const s = summarizePeriod(
      [
        { amount: 10, type: "earn" },
        { amount: 5, type: "earn" },
        { amount: -6, type: "spend" },
        { amount: 4, type: "manual_adjustment" },
        { amount: -1, type: "manual_adjustment" },
      ],
      [
        { approved_at: "2026-11-02", expand: { chore: { reward: 0, reward_minutes: 10, pay_mode: "time" } } },
        { approved_at: "2026-11-03", expand: { chore: { reward: 5, reward_minutes: 99, pay_mode: "bucks" } } },
        { approved_at: "2026-11-03" },
      ],
    );
    expect(s).toEqual({ earned: 15, adjustments: 3, spent: 6, bonusMinutes: 10, chores: 3 });
  });
  it("adds per-kid summaries and reports percent change", () => {
    const a = { earned: 1, adjustments: 0, spent: 2, bonusMinutes: 5, chores: 1 };
    expect(addSummaries([a, a])).toEqual({ earned: 2, adjustments: 0, spent: 4, bonusMinutes: 10, chores: 2 });
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(5, 0)).toBeNull();
  });
});
