import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCREEN_RATE,
  SCREEN_PRESETS,
  isScreenPreset,
  screenCost,
  screenDescription,
  screenRate,
} from "./screenTime";

describe("isScreenPreset", () => {
  it("accepts only the 15-minute presets up to an hour", () => {
    for (const m of SCREEN_PRESETS) expect(isScreenPreset(m)).toBe(true);
    for (const m of [0, 10, 20, 75, 90, -15, "30", null, undefined, 30.5]) {
      expect(isScreenPreset(m)).toBe(false);
    }
  });
});

describe("screenRate", () => {
  it("falls back to the default for unset, zero, or negative rates", () => {
    expect(screenRate(undefined)).toBe(DEFAULT_SCREEN_RATE);
    expect(screenRate(null)).toBe(DEFAULT_SCREEN_RATE);
    expect(screenRate({})).toBe(DEFAULT_SCREEN_RATE);
    expect(screenRate({ screen_rate: 0 })).toBe(DEFAULT_SCREEN_RATE);
    expect(screenRate({ screen_rate: -2 })).toBe(DEFAULT_SCREEN_RATE);
  });

  it("uses a positive household rate", () => {
    expect(screenRate({ screen_rate: 2 })).toBe(2);
    expect(screenRate({ screen_rate: 0.5 })).toBe(0.5);
  });
});

describe("screenCost", () => {
  it("is minutes × rate at 1:1 and whole multiples", () => {
    expect(screenCost(15, 1)).toBe(15);
    expect(screenCost(60, 2)).toBe(120);
  });

  it("rounds fractional costs up to a whole buck", () => {
    expect(screenCost(15, 0.5)).toBe(8);
    expect(screenCost(45, 0.1)).toBe(5);
  });
});

describe("screenDescription", () => {
  it("names the minutes", () => {
    expect(screenDescription(30)).toBe("30 min screen time");
  });
});
