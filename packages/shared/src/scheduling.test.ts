import { describe, expect, it } from "vitest";
import {
  computeDueStage,
  isCurrencyExpired,
  shouldEscalate,
  shouldFireNudge,
  shouldFireReminder,
  shouldSendWeeklyDigest,
} from "./scheduling";

// shouldFireReminder compares a server-local "HH:MM" against `now.getHours()`
// (local), which is TZ-sensitive. Pin to UTC so the tests are deterministic
// regardless of the machine/CI runner's local timezone.
process.env.TZ = "UTC";

describe("shouldFireNudge", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("fires once a completed chore has sat unapproved past nudgeHours", () => {
    const completedAt = new Date("2026-08-12T09:00:00Z"); // 3h ago
    expect(shouldFireNudge(now, completedAt, null, 2, false)).toBe(true);
  });

  it("does not fire before nudgeHours has elapsed", () => {
    const completedAt = new Date("2026-08-12T11:00:00Z"); // 1h ago
    expect(shouldFireNudge(now, completedAt, null, 2, false)).toBe(false);
  });

  it("does not re-fire once already nudged for this completion", () => {
    const completedAt = new Date("2026-08-12T09:00:00Z");
    const nudgedAt = new Date("2026-08-12T10:00:00Z"); // after completedAt
    expect(shouldFireNudge(now, completedAt, nudgedAt, 2, false)).toBe(false);
  });

  it("re-fires after a resubmit newer than the last nudge", () => {
    const nudgedAt = new Date("2026-08-11T09:00:00Z");
    const completedAt = new Date("2026-08-12T09:00:00Z"); // newer than nudgedAt
    expect(shouldFireNudge(now, completedAt, nudgedAt, 2, false)).toBe(true);
  });

  it("is disabled when nudgeHours is 0 (feature off)", () => {
    const completedAt = new Date("2026-08-01T00:00:00Z");
    expect(shouldFireNudge(now, completedAt, null, 0, false)).toBe(false);
  });

  it("does not fire in vacation mode", () => {
    const completedAt = new Date("2026-08-12T09:00:00Z");
    expect(shouldFireNudge(now, completedAt, null, 2, true)).toBe(false);
  });
});

describe("shouldFireReminder", () => {
  it("fires on the first tick at/after the scheduled time", () => {
    const now = new Date("2026-08-12T08:00:00Z");
    expect(shouldFireReminder(now, "08:00", null, false)).toBe(true);
  });

  it("does not fire before the scheduled time", () => {
    const now = new Date("2026-08-12T07:59:00Z");
    expect(shouldFireReminder(now, "08:00", null, false)).toBe(false);
  });

  it("does not fire twice on the same day", () => {
    const now = new Date("2026-08-12T09:00:00Z");
    const lastRemindedAt = new Date("2026-08-12T08:00:00Z");
    expect(shouldFireReminder(now, "08:00", lastRemindedAt, false)).toBe(false);
  });

  it("fires again the next day", () => {
    const now = new Date("2026-08-13T08:00:00Z");
    const lastRemindedAt = new Date("2026-08-12T08:00:00Z");
    expect(shouldFireReminder(now, "08:00", lastRemindedAt, false)).toBe(true);
  });

  it("does not fire in vacation mode", () => {
    const now = new Date("2026-08-12T08:00:00Z");
    expect(shouldFireReminder(now, "08:00", null, true)).toBe(false);
  });
});

describe("computeDueStage", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("is 0 when more than 24h remain", () => {
    expect(computeDueStage(now, new Date("2026-08-14T00:00:00Z"))).toBe(0);
  });

  it("is 1 within 24h", () => {
    expect(computeDueStage(now, new Date("2026-08-13T00:00:00Z"))).toBe(1);
  });

  it("is 2 within 2h", () => {
    expect(computeDueStage(now, new Date("2026-08-12T13:30:00Z"))).toBe(2);
  });

  it("is 3 once overdue", () => {
    expect(computeDueStage(now, new Date("2026-08-12T11:59:00Z"))).toBe(3);
  });

  it("is 3 exactly at the due instant", () => {
    expect(computeDueStage(now, now)).toBe(3);
  });
});

describe("shouldEscalate", () => {
  it("fires when the stage increases", () => {
    expect(shouldEscalate(2, 1, false)).toBe(true);
  });

  it("does not re-fire for the same stage already notified", () => {
    expect(shouldEscalate(2, 2, false)).toBe(false);
  });

  it("does not fire for stage 0 (not due-soon yet)", () => {
    expect(shouldEscalate(0, 0, false)).toBe(false);
  });

  it("does not fire in vacation mode even if the stage increased", () => {
    expect(shouldEscalate(3, 1, true)).toBe(false);
  });
});

describe("isCurrencyExpired", () => {
  const now = new Date("2026-08-12T00:00:00Z");

  it("expires an earn entry older than expiryDays", () => {
    const createdAt = new Date("2026-07-01T00:00:00Z"); // 42 days ago
    expect(isCurrencyExpired(now, createdAt, 30, false)).toBe(true);
  });

  it("does not expire an entry within expiryDays", () => {
    const createdAt = new Date("2026-08-01T00:00:00Z"); // 11 days ago
    expect(isCurrencyExpired(now, createdAt, 30, false)).toBe(false);
  });

  it("is disabled when expiryDays is 0", () => {
    const createdAt = new Date("2020-01-01T00:00:00Z");
    expect(isCurrencyExpired(now, createdAt, 0, false)).toBe(false);
  });

  it("does not expire anything in vacation mode", () => {
    const createdAt = new Date("2026-07-01T00:00:00Z");
    expect(isCurrencyExpired(now, createdAt, 30, true)).toBe(false);
  });
});

describe("shouldSendWeeklyDigest", () => {
  it("sends when not on vacation", () => {
    expect(shouldSendWeeklyDigest(false)).toBe(true);
  });

  it("skips entirely in vacation mode", () => {
    expect(shouldSendWeeklyDigest(true)).toBe(false);
  });
});
