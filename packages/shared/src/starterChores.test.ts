import { describe, expect, it } from "vitest";
import { addableStarterChores, STARTER_BANDS } from "./starterChores";

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

  it("scales rewards up with age (median per band never drops)", () => {
    const medians = STARTER_BANDS.map((b) => {
      const r = b.chores.map((c) => c.reward).sort((a, z) => a - z);
      return r[Math.floor(r.length / 2)] ?? 0;
    });
    expect(medians).toEqual([...medians].sort((a, z) => a - z));
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
