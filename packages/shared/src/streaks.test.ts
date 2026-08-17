import { describe, expect, it } from "vitest";
import { DEFAULT_STREAK_MILESTONES, computeStreak, getMilestoneBonus } from "./streaks";

describe("computeStreak", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("counts consecutive earn days ending today", () => {
    const earnDates = ["2026-08-12", "2026-08-11", "2026-08-10"];
    expect(computeStreak(now, earnDates)).toBe(3);
  });

  it("applies the grace period when today has no earn yet but yesterday does", () => {
    const earnDates = ["2026-08-11", "2026-08-10"];
    expect(computeStreak(now, earnDates)).toBe(2);
  });

  it("is 0 once the streak is broken (gap before yesterday)", () => {
    const earnDates = ["2026-08-09"]; // neither today nor yesterday
    expect(computeStreak(now, earnDates)).toBe(0);
  });

  it("is 0 with no earn history at all", () => {
    expect(computeStreak(now, [])).toBe(0);
  });

  it("does not advance the streak in vacation mode (no earn transactions produced)", () => {
    // Vacation mode has no explicit flag here: a paused household simply
    // never creates `earn` transactions, so the streak breaks on its own.
    const earnDates: string[] = []; // household paused all week, nothing earned
    expect(computeStreak(now, earnDates)).toBe(0);
  });

  it("stops counting at a gap in the middle of the history", () => {
    const earnDates = ["2026-08-12", "2026-08-11", "2026-08-09"]; // missing the 10th
    expect(computeStreak(now, earnDates)).toBe(2);
  });
});

describe("getMilestoneBonus", () => {
  it("grants the bonus when the streak newly crosses a milestone", () => {
    expect(getMilestoneBonus(3, 2, DEFAULT_STREAK_MILESTONES)).toBe(5);
    expect(getMilestoneBonus(7, 6, DEFAULT_STREAK_MILESTONES)).toBe(15);
    expect(getMilestoneBonus(14, 13, DEFAULT_STREAK_MILESTONES)).toBe(40);
    expect(getMilestoneBonus(30, 29, DEFAULT_STREAK_MILESTONES)).toBe(100);
  });

  it("does not re-grant a milestone already passed (streak unchanged)", () => {
    expect(getMilestoneBonus(3, 3, DEFAULT_STREAK_MILESTONES)).toBeUndefined();
  });

  it("does not fire on a non-milestone day even if the streak grew", () => {
    expect(getMilestoneBonus(4, 3, DEFAULT_STREAK_MILESTONES)).toBeUndefined();
  });

  it("does not fire when the streak drops (broken streak)", () => {
    expect(getMilestoneBonus(0, 5, DEFAULT_STREAK_MILESTONES)).toBeUndefined();
  });

  it("respects per-household override amounts", () => {
    const overridden = { ...DEFAULT_STREAK_MILESTONES, 3: 999 };
    expect(getMilestoneBonus(3, 2, overridden)).toBe(999);
  });

  it("does not fire in vacation mode (streak never reaches the milestone)", () => {
    // As with computeStreak, there's no explicit vacation flag: while paused
    // no earn transactions occur, so the streak can't cross a milestone.
    const prevStreak = 2;
    const streakDuringVacation = 2; // unchanged — nothing was earned
    expect(getMilestoneBonus(streakDuringVacation, prevStreak, DEFAULT_STREAK_MILESTONES)).toBeUndefined();
  });
});
