import { describe, expect, it } from "vitest";
import { addableStarterChores, knownChoreNames, starterChoreInput, STARTER_BANDS } from "./starterChores";

describe("starter chores", () => {
  it("has unique band ids and non-empty bands", () => {
    const ids = STARTER_BANDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const band of STARTER_BANDS) expect(band.chores.length).toBeGreaterThan(0);
  });

  it("has unique chore names within a band, so the picker can dedupe by name", () => {
    for (const band of STARTER_BANDS) {
      const names = band.chores.map((c) => c.name);
      expect(new Set(names).size, band.id).toBe(names.length);
    }
  });

  it("gives every chore a positive whole reward, and recurring ones a cadence", () => {
    for (const band of STARTER_BANDS) {
      for (const c of band.chores) {
        expect(Number.isInteger(c.reward) && c.reward > 0, `${band.id}/${c.name}`).toBe(true);
        if (c.type === "recurring") expect(c.cadence, `${band.id}/${c.name}`).toBeTruthy();
        else expect(c.cadence).toBeUndefined();
      }
    }
  });

  it("gives every chore a repeat limit; recurring ones allow one per cadence window", () => {
    for (const band of STARTER_BANDS) {
      for (const c of band.chores) {
        expect(Number.isInteger(c.max_per_period) && c.max_per_period > 0, `${band.id}/${c.name}`).toBe(true);
        if (c.type === "recurring") expect(c.max_per_period, `${band.id}/${c.name}`).toBe(1);
      }
    }
  });

  it("scales rewards up with age (median per band never drops)", () => {
    const medians = STARTER_BANDS.map((b) => {
      const r = b.chores.map((c) => c.reward).sort((a, z) => a - z);
      return r[Math.floor(r.length / 2)] ?? 0;
    });
    expect(medians).toEqual([...medians].sort((a, z) => a - z));
  });
});

describe("starter chore pricing", () => {
  // Full recurring week (daily x7 + weekly x1) at screen_rate 3 bucks/min.
  const TARGET_MIN_PER_DAY: Record<string, number> = { "4-6": 30, "7-9": 40, "10-12": 55, "13+": 70 };
  const SCREEN_RATE = 3;

  it("pays a full recurring week within 5% of the per-band screen-time target", () => {
    for (const band of STARTER_BANDS) {
      const weekly = band.chores
        .filter((c) => c.type === "recurring")
        .reduce((sum, c) => sum + c.reward * (c.cadence === "daily" ? 7 : c.cadence === "weekly" ? 1 : 7 / 30), 0);
      const target = TARGET_MIN_PER_DAY[band.id]! * 7 * SCREEN_RATE;
      expect(Math.abs(weekly - target) / target, `${band.id}: ${weekly} vs ${target}`).toBeLessThanOrEqual(0.05);
    }
  });
});

describe("addableStarterChores", () => {
  it("skips chores the household already has, ignoring case and whitespace", () => {
    const band = STARTER_BANDS[0]!;
    const first = band.chores[0]!.name;
    const addable = addableStarterChores(band, [`  ${first.toUpperCase()} `]);
    expect(addable.some((c) => c.name === first)).toBe(false);
    expect(addable).toHaveLength(band.chores.length - 1);
  });
});

describe("renamed starter chores", () => {
  it("still count as added after the chore is renamed", () => {
    const band = STARTER_BANDS[0]!;
    const orig = band.chores[0]!;
    const created = { ...starterChoreInput(orig, "h", "p"), name: "Feed the cats" };
    expect(created.starter_key).toBe(orig.name);
    const addable = addableStarterChores(band, knownChoreNames([created]));
    expect(addable.some((c) => c.name === orig.name)).toBe(false);
  });

  it("knownChoreNames includes plain names for chores with no starter origin", () => {
    expect(knownChoreNames([{ name: "Dishes" }])).toEqual(["Dishes"]);
  });
});
