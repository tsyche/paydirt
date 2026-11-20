import { describe, expect, it } from "vitest";
import {
  partialBonusMessage,
  adjustmentToGrit,
  submitAdjustBonus,
  validateAdjustBonus,
  validBonusMinutes,
} from "./adjustBonus";
import { effectiveGoodsRate } from "./overview";

describe("dollar bonus and deduction amounts", () => {
  it("converts signed dollars and cents without rounding away fractional grit", () => {
    expect(adjustmentToGrit(2.5, "dollars", 88)).toBe(220);
    expect(adjustmentToGrit(-2.5, "dollars", 88)).toBe(-220);
    expect(adjustmentToGrit(0.01, "dollars", 88)).toBe(0.88);
    expect(adjustmentToGrit(-0.01, "dollars", 88)).toBe(-0.88);
    expect(adjustmentToGrit(1.1, "dollars", 88)).toBe(96.8);
  });

  it("uses kid overrides or the household rate and leaves grit input unchanged", () => {
    expect(adjustmentToGrit(2, "dollars", effectiveGoodsRate(44, 88))).toBe(88);
    expect(adjustmentToGrit(2, "dollars", effectiveGoodsRate(0, 88))).toBe(176);
    expect(adjustmentToGrit(-3.25, "grit", 0)).toBe(-3.25);
  });

  it("rejects missing/invalid rates, sub-cent input and non-finite amounts", () => {
    for (const rate of [0, -1, NaN, Infinity]) expect(adjustmentToGrit(2, "dollars", rate)).toBeNaN();
    for (const amount of [0.001, -1.001, NaN, Infinity, 1e20]) expect(adjustmentToGrit(amount, "dollars", 88)).toBeNaN();
  });
});

describe("validBonusMinutes", () => {
  it("accepts 5–120 in five-minute steps", () => {
    for (const m of [5, 10, 30, 60, 120]) expect(validBonusMinutes(m)).toBe(true);
  });

  it("rejects out-of-range, off-step and fractional minutes", () => {
    for (const m of [0, 4, 7, 125, -5, 7.5, NaN]) expect(validBonusMinutes(m)).toBe(false);
  });
});

describe("validateAdjustBonus", () => {
  it("grit mode: requires non-zero signed amount and a reason", () => {
    expect(validateAdjustBonus({ mode: "grit", grit: 5, minutes: 0, reason: "Chore tax" })).toBeNull();
    expect(validateAdjustBonus({ mode: "grit", grit: -3, minutes: 0, reason: "Oops" })).toBeNull();
    expect(validateAdjustBonus({ mode: "grit", grit: 0, minutes: 0, reason: "x" })).toMatch(/non-zero/);
    expect(validateAdjustBonus({ mode: "grit", grit: 5, minutes: 0, reason: "  " })).toMatch(/Reason/);
  });

  it("time mode: enforces the 5–120 step rule, reason stays optional", () => {
    expect(validateAdjustBonus({ mode: "time", grit: 0, minutes: 30, reason: "" })).toBeNull();
    expect(validateAdjustBonus({ mode: "time", grit: 0, minutes: 7, reason: "" })).toMatch(/5–120/);
    expect(validateAdjustBonus({ mode: "time", grit: 0, minutes: 200, reason: "" })).toMatch(/5–120/);
  });

  it("both mode: needs a non-zero grit, valid minutes, and a shared note", () => {
    expect(
      validateAdjustBonus({ mode: "both", grit: 4, minutes: 15, reason: "Great week" }),
    ).toBeNull();
    expect(
      validateAdjustBonus({ mode: "both", grit: 0, minutes: 15, reason: "Great week" }),
    ).toMatch(/grit/);
    expect(
      validateAdjustBonus({ mode: "both", grit: 4, minutes: 7, reason: "Great week" }),
    ).toMatch(/5–120/);
    expect(
      validateAdjustBonus({ mode: "both", grit: 4, minutes: 15, reason: "" }),
    ).toMatch(/note/i);
  });

  it("rejects notes over 500 characters", () => {
    expect(
      validateAdjustBonus({ mode: "grit", grit: 1, minutes: 0, reason: "x".repeat(501) }),
    ).toMatch(/500/);
  });
});

describe("submitAdjustBonus", () => {
  const ok = () => Promise.resolve();
  const fail = (msg: string) => () => Promise.reject(new Error(msg));

  it("runs both halves for combined mode", async () => {
    const order: string[] = [];
    const result = await submitAdjustBonus(
      {
        giveTime: () => { order.push("time"); return ok(); },
        giveGrit: () => { order.push("grit"); return ok(); },
      },
      "both",
    );
    expect(order).toEqual(["time", "grit"]);
    expect(result).toEqual({ applied: "both", error: null });
  });

  it("stops after a failed time half and reports applied none", async () => {
    const result = await submitAdjustBonus(
      { giveTime: fail("time down"), giveGrit: ok },
      "both",
    );
    expect(result.applied).toBe("none");
    expect((result.error as Error).message).toBe("time down");
  });

  it("keeps applied time when only the grit half fails", async () => {
    const result = await submitAdjustBonus(
      { giveTime: ok, giveGrit: fail("grit down") },
      "both",
    );
    expect(result.applied).toBe("time");
    expect((result.error as Error).message).toBe("grit down");
  });

  it("runs only the selected half in single modes", async () => {
    let gritRuns = 0;
    let timeRuns = 0;
    const runs = {
      giveTime: () => { timeRuns += 1; return ok(); },
      giveGrit: () => { gritRuns += 1; return ok(); },
    };
    expect(await submitAdjustBonus(runs, "grit")).toEqual({ applied: "grit", error: null });
    expect(await submitAdjustBonus(runs, "time")).toEqual({ applied: "time", error: null });
    expect(timeRuns).toBe(1);
    expect(gritRuns).toBe(1);
  });

  it("ignores a failing unused half in single modes", async () => {
    const result = await submitAdjustBonus(
      { giveTime: fail("should not run"), giveGrit: ok },
      "grit",
    );
    expect(result).toEqual({ applied: "grit", error: null });
  });
});

describe("partialBonusMessage", () => {
  it("describes which half landed", () => {
    expect(partialBonusMessage("time", "boom")).toMatch(/grit half failed/);
    expect(partialBonusMessage("grit", "boom")).toMatch(/time half failed/);
    expect(partialBonusMessage("both", "boom")).toBeNull();
    expect(partialBonusMessage("none", "boom")).toBeNull();
  });
});
