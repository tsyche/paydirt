import { describe, it, expect } from "vitest";
import { computeBadges, earnedBadges, shouldCelebrate } from "./badges";

const EMPTY = { approvedCount: 0, streakDays: 0, goalsAchieved: 0, balance: 0 };

describe("computeBadges", () => {
  it("marks nothing earned on an empty profile", () => {
    const badges = computeBadges(EMPTY);
    expect(badges.length).toBeGreaterThanOrEqual(10);
    for (const b of badges) {
      expect(b.earned).toBe(false);
      expect(b.progress).toBe("0/" + b.progress!.split("/")[1]);
    }
  });

  it("earns first chore at 1 approved and shows remaining progress", () => {
    const badges = computeBadges({ ...EMPTY, approvedCount: 1 });
    const first = badges.find((b) => b.id === "first_chore")!;
    expect(first.earned).toBe(true);
    expect(first.progress).toBeNull();
    const ten = badges.find((b) => b.id === "ten_chores")!;
    expect(ten.earned).toBe(false);
    expect(ten.progress).toBe("1/10");
  });

  it("earns milestone tiers independently", () => {
    const stats = { approvedCount: 12, streakDays: 7, goalsAchieved: 1, balance: 150 };
    const badges = computeBadges(stats);
    expect(badges.find((b) => b.id === "first_chore")!.earned).toBe(true);
    expect(badges.find((b) => b.id === "ten_chores")!.earned).toBe(true);
    expect(badges.find((b) => b.id === "fifty_chores")!.earned).toBe(false);
    expect(badges.find((b) => b.id === "streak_3")!.earned).toBe(true);
    expect(badges.find((b) => b.id === "streak_7")!.earned).toBe(true);
    expect(badges.find((b) => b.id === "streak_30")!.earned).toBe(false);
    expect(badges.find((b) => b.id === "first_goal")!.earned).toBe(true);
    expect(badges.find((b) => b.id === "century")!.earned).toBe(true);
    expect(badges.find((b) => b.id === "half_k")!.earned).toBe(false);
    expect(badges.find((b) => b.id === "half_k")!.progress).toBe("150/500");
  });

  it("earnedBadges filters to wins only", () => {
    const earned = earnedBadges({ approvedCount: 3, streakDays: 3, goalsAchieved: 0, balance: 0 });
    expect(earned.map((b) => b.id).sort()).toEqual(["first_chore", "streak_3"]);
    expect(earned.every((b) => b.earned)).toBe(true);
  });
});

describe("shouldCelebrate", () => {
  it("fires on an increase", () => {
    expect(shouldCelebrate(10, 15, false)).toBe(true);
  });

  it("stays quiet on decrease, no change, or first load", () => {
    expect(shouldCelebrate(15, 10, false)).toBe(false);
    expect(shouldCelebrate(15, 15, false)).toBe(false);
    expect(shouldCelebrate(null, 5, false)).toBe(false);
  });

  it("respects the calm-mode dial", () => {
    expect(shouldCelebrate(10, 15, true)).toBe(false);
  });
});
