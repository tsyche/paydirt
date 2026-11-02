import { describe, expect, it } from "vitest";
import {
  addSummaries, bankSummary, effectiveGoodsRate, bankView, householdWeeklyBucks, bucksToMinutes, costStrip, occurrencesPerWeek, pctChange, periodRange, periodWeeks,
  splitSpend, summarizePeriod,
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

describe("periodWeeks / splitSpend / costStrip", () => {
  it("periodWeeks measures a range in weeks", () => {
    expect(periodWeeks({ start: "2026-11-02", end: "2026-11-09" })).toBe(1);
    expect(periodWeeks({ start: "2026-11-01", end: "2026-12-01" })).toBeCloseTo(30 / 7);
  });
  it("splitSpend separates screen time from goods and counts minutes once per request", () => {
    const s = splitSpend(
      [
        { amount: -6, type: "spend", related_spend_request: "a" },
        { amount: -4, type: "spend", related_spend_request: "a" },
        { amount: -20, type: "spend", related_spend_request: "g" },
        { amount: -3, type: "spend" },
        { amount: 9, type: "earn", related_spend_request: "a" },
      ],
      [{ id: "a", screen_minutes: 30 }, { id: "g" }],
    );
    expect(s).toEqual({ screenBucks: 10, screenMinutes: 30, goodsBucks: 23 });
  });
  it("costStrip scales the weekly ceiling and guards divide-by-zero", () => {
    expect(costStrip(50, 100, 2, 10)).toEqual({ paid: 50, max: 200, pct: 25, paidDollars: 5, maxDollars: 20 });
    expect(costStrip(5, 0, 4, 0)).toEqual({ paid: 5, max: 0, pct: null, paidDollars: null, maxDollars: null });
  });
});

describe("bankSummary", () => {
  it("totals are the sum of per-kid rows, honoring per-kid dollar rates", () => {
    const b = bankSummary(
      [
        { id: "a", display_name: "A", balance: 176, goods_rate: 44 },
        { id: "b", display_name: "B", balance: 88 },
      ],
      88,
      0.6,
    );
    expect(b.rows.map((r) => r.dollars)).toEqual([4, 1]);
    expect(b.total).toEqual({ balance: 264, dollars: 5, screenMinutes: 290 + 145 });
  });
  it("has no dollar total without any rate", () => {
    expect(bankSummary([{ id: "a", display_name: "A", balance: 10 }], 0, 0.6).total.dollars).toBeNull();
  });
});

describe("householdWeeklyBucks", () => {
  const base = { type: "recurring", cadence: "weekly", reward: 10 } as const;
  it("counts a race chore once but a normal chore per holder", () => {
    const chores = [{ ...base, id: "r", race: true }, { ...base, id: "n" }];
    expect(householdWeeklyBucks(chores, { r: 2, n: 2 })).toBe(10 + 20);
  });
  it("ignores unheld chores and one-offs", () => {
    expect(householdWeeklyBucks([{ ...base, id: "x" }, { type: "oneoff", reward: 9, id: "y" }], { y: 1 })).toBe(0);
  });
});

describe("effectiveGoodsRate", () => {
  it("treats 0/null/undefined kid rates as no override (PocketBase stores empty numbers as 0)", () => {
    expect(effectiveGoodsRate(0, 10)).toBe(10);
    expect(effectiveGoodsRate(null, 10)).toBe(10);
    expect(effectiveGoodsRate(undefined, 10)).toBe(10);
    expect(effectiveGoodsRate(44, 10)).toBe(44);
    expect(effectiveGoodsRate(0, undefined)).toBe(0);
  });
  it("bankSummary gives dollars to kids with a 0 override", () => {
    expect(bankSummary([{ id: "a", display_name: "A", balance: 85, goods_rate: 0 }], 10, 1).rows[0]?.dollars).toBe(8.5);
  });
});
