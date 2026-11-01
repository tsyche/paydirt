import { describe, expect, it } from "vitest";
import { shouldPlayCelebration } from "./celebration";

describe("shouldPlayCelebration", () => {
  it("does not play on remount with a stale non-zero trigger", () => {
    expect(shouldPlayCelebration(3, 3)).toBe(false);
  });
  it("does not play for the initial zero", () => {
    expect(shouldPlayCelebration(0, 0)).toBe(false);
  });
  it("plays when the trigger increments", () => {
    expect(shouldPlayCelebration(3, 4)).toBe(true);
    expect(shouldPlayCelebration(0, 1)).toBe(true);
  });
});
