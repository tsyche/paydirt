import { describe, expect, it } from "vitest";
import {
  buildDigestMessage,
  computeDueStage,
  digestTimeFor,
  expiryLapse,
  isCurrencyExpired,
  type LedgerRow,
  shouldEscalate,
  shouldFireDigest,
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

describe("kid chore digest", () => {
  const sat = new Date("2026-08-15T10:05:00Z"); // Saturday
  const mon = new Date("2026-08-17T15:00:00Z"); // Monday

  it("picks weekend time on Sat/Sun and weekday time otherwise", () => {
    expect(digestTimeFor(sat, "14:45", "10:00")).toBe("10:00");
    expect(digestTimeFor(new Date("2026-08-16T12:00:00Z"), "14:45", "10:00")).toBe("10:00");
    expect(digestTimeFor(mon, "14:45", "10:00")).toBe("14:45");
  });

  it("fires at/after the time, once per local day", () => {
    expect(shouldFireDigest(mon, "14:45", "", false)).toBe(true);
    expect(shouldFireDigest(mon, "15:30", "", false)).toBe(false); // not yet
    expect(shouldFireDigest(mon, "14:45", "2026-08-17", false)).toBe(false); // already sent today
    expect(shouldFireDigest(mon, "14:45", "2026-08-16", false)).toBe(true); // sent yesterday
  });

  it("stays off when blank, malformed, or on vacation", () => {
    expect(shouldFireDigest(mon, "", "", false)).toBe(false);
    expect(shouldFireDigest(mon, "3pm", "", false)).toBe(false);
    expect(shouldFireDigest(mon, "14:45", "", true)).toBe(false);
  });

  it("summarises with a count and at most three names", () => {
    expect(buildDigestMessage(["Dishes"])).toBe("1 chore today: Dishes");
    expect(buildDigestMessage(["A", "B", "C", "D", "E"])).toBe("5 chores today: A, B, C +2 more");
  });
});

describe("expiryLapse", () => {
  const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const row = (id: string, type: LedgerRow["type"], amount: number, day: string, extra: Partial<LedgerRow> = {}): LedgerRow => ({
    id, type, amount, created: d(day), ...extra,
  });
  const now = d("2026-08-31");

  it("does not charge a fresh earn for an old one that was already spent", () => {
    const rows = [
      row("a", "earn", 100, "2026-07-01"),
      row("s", "spend", -100, "2026-07-05"),
      row("b", "earn", 50, "2026-08-10"),
    ];
    // balance 50; the old 100 is fully spent, so nothing lapses (the old code lapsed 50).
    expect(expiryLapse(rows, now, 30, 50)).toEqual({ lapse: 0, staleIds: ["a"] });
  });

  it("lapses only what is left of a partly spent lot", () => {
    const rows = [row("a", "earn", 100, "2026-07-01"), row("s", "spend", -30, "2026-07-05")];
    expect(expiryLapse(rows, now, 30, 70)).toEqual({ lapse: 70, staleIds: ["a"] });
  });

  it("spends consume the oldest lot first", () => {
    const rows = [
      row("a", "earn", 40, "2026-07-01"),
      row("b", "earn", 40, "2026-07-02"),
      row("s", "spend", -50, "2026-07-10"),
    ];
    // 40 from a, 10 from b -> only 30 of b is left to lapse.
    expect(expiryLapse(rows, now, 30, 30)).toEqual({ lapse: 30, staleIds: ["a", "b"] });
  });

  it("never lapses non-earn credits, and caps at balance", () => {
    const rows = [row("a", "earn", 100, "2026-07-01"), row("k", "manual_adjustment", 100, "2026-07-02")];
    expect(expiryLapse(rows, now, 30, 100)).toEqual({ lapse: 100, staleIds: ["a"] });
    expect(expiryLapse(rows, now, 30, 60).lapse).toBe(60);
  });

  it("ignores earn rows inside the window and expiry-off", () => {
    expect(expiryLapse([row("a", "earn", 10, "2026-08-25")], now, 30, 10)).toEqual({ lapse: 0, staleIds: [] });
    expect(expiryLapse([row("a", "earn", 10, "2026-01-01")], now, 0, 10)).toEqual({ lapse: 0, staleIds: [] });
  });

  it("is idempotent: a processed lot and its lapse row are not counted again", () => {
    const rows = [
      row("a", "earn", 100, "2026-06-01", { expiry_processed: true }),
      row("lapse", "manual_adjustment", -100, "2026-07-01", { reason: "Expired rewards (older than 30 days)" }),
      row("b", "earn", 20, "2026-07-20"),
    ];
    expect(expiryLapse(rows, now, 30, 20)).toEqual({ lapse: 20, staleIds: ["b"] });
  });

  it("a spend after a lot lapsed cannot consume that dead lot", () => {
    const rows = [
      row("a", "earn", 100, "2026-06-01", { expiry_processed: true }),
      row("b", "earn", 50, "2026-07-20"),
      row("s", "spend", -20, "2026-08-10"),
    ];
    expect(expiryLapse(rows, now, 30, 30)).toEqual({ lapse: 30, staleIds: ["b"] });
  });
});
