import { afterEach, describe, expect, it } from "vitest";
import { localDateInstant, localDateKey, localDateLabel, setHouseholdTimeZone, householdMonthRange } from "./dates";
import { shouldFireReminder } from "./scheduling";
import { computeStreak } from "./streaks";

describe("local calendar boundaries", () => {
  afterEach(() => setHouseholdTimeZone());
  it("round-trips date inputs through local midnight", () => {
    const midnight = new Date("2026-11-03T08:00:00Z");
    expect(localDateInstant("2026-11-03")).toBe(midnight.toISOString());
    expect(localDateKey(midnight.toISOString())).toBe("2026-11-03");
  });
  it("formats late evening timestamps using their local day", () => {
    const evening = new Date("2026-11-04T07:30:00Z");
    expect(localDateKey(evening.toISOString())).toBe("2026-11-03");
    expect(localDateLabel(evening.toISOString())).toBe(evening.toLocaleDateString(undefined, { timeZone: "America/Los_Angeles" }));
  });
  it("deduplicates reminders by local day across UTC midnight", () => {
    const afternoon = new Date(2026, 10, 3, 14);
    const evening = new Date(2026, 10, 3, 23);
    expect(shouldFireReminder(evening, "13:00", afternoon, false)).toBe(false);
    expect(shouldFireReminder(new Date(2026, 10, 4, 14), "13:00", evening, false)).toBe(true);
  });
  it("counts a streak through local midnight and DST", () => {
    expect(computeStreak(new Date("2026-11-02T08:01:00Z"), ["2026-10-31", "2026-11-01"])).toBe(2);
  });
  it("uses the household setting when changed, independently of the device timezone", () => {
    setHouseholdTimeZone("Asia/Tokyo");
    expect(localDateKey("2026-11-04T07:30:00Z")).toBe("2026-11-04");
    expect(localDateInstant("2026-11-04")).toBe("2026-11-03T15:00:00.000Z");
    setHouseholdTimeZone("America/Los_Angeles");
    expect(localDateKey("2026-11-04T07:30:00Z")).toBe("2026-11-03");
  });
  it("uses DST-aware midnight boundaries for monthly reports", () => {
    expect(householdMonthRange(2026, 3)).toEqual({ start: "2026-03-01T08:00:00.000Z", end: "2026-04-01T07:00:00.000Z" });
    expect(localDateInstant("2026-03-08")).toBe("2026-03-08T08:00:00.000Z");
    expect(localDateInstant("2026-03-09")).toBe("2026-03-09T07:00:00.000Z");
    expect(() => localDateInstant("2026-03-08T02:30")).toThrow("does not exist");
  });
});
