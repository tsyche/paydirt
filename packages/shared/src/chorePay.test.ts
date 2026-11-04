import { describe, expect, it } from "vitest";
import { normalizePay, payLabel, payMode, validatePay } from "./chorePay";

describe("chore pay mode", () => {
  it("treats empty or unknown pay_mode as bucks", () => {
    expect(payMode({})).toBe("bucks");
    expect(payMode({ pay_mode: "" })).toBe("bucks");
    expect(payMode({ pay_mode: "bogus" })).toBe("bucks");
    expect(payMode({ pay_mode: "time" })).toBe("time");
  });

  it("pays only what the mode says", () => {
    expect(normalizePay({ reward: 15, reward_minutes: 10 })).toEqual({ mode: "bucks", bucks: 15, minutes: 0 });
    expect(normalizePay({ pay_mode: "time", reward: 15, reward_minutes: 10 })).toEqual({ mode: "time", bucks: 0, minutes: 10 });
    expect(normalizePay({ pay_mode: "both", reward: 15, reward_minutes: 10 })).toEqual({ mode: "both", bucks: 15, minutes: 10 });
  });

  it("validates each mode", () => {
    expect(validatePay({ reward: 15 })).toBeNull();
    expect(validatePay({ reward: 0 })).toMatch(/reward/);
    expect(validatePay({ pay_mode: "time", reward_minutes: 10 })).toBeNull();
    expect(validatePay({ pay_mode: "time", reward_minutes: 0 })).toMatch(/minutes/);
    expect(validatePay({ pay_mode: "time", reward_minutes: 2 })).toMatch(/at least 5 minutes/);
    expect(validatePay({ pay_mode: "time", reward_minutes: 7 })).toMatch(/steps of 5/);
    expect(validatePay({ pay_mode: "time", reward_minutes: 600 })).toMatch(/capped/);
    expect(validatePay({ pay_mode: "both", reward: 0, reward_minutes: 10 })).toMatch(/reward/);
    expect(validatePay({ pay_mode: "both", reward: 5, reward_minutes: 10 })).toBeNull();
  });

  it("labels the payout", () => {
    expect(payLabel({ reward: 15 }, "Grit")).toBe("15 Grit");
    expect(payLabel({ pay_mode: "time", reward_minutes: 10 }, "Grit")).toBe("10 min");
    expect(payLabel({ pay_mode: "both", reward: 15, reward_minutes: 10 }, "Grit")).toBe("15 Grit + 10 min");
    expect(payLabel({ pay_mode: "both", reward: 15, reward_minutes: 10 }, "")).toBe("15 + 10 min");
  });
});
