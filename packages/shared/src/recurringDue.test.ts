import { createRequire } from "node:module";
import { afterAll, describe, expect, it, vi } from "vitest";
import { installPocketBaseCalendar } from "./pocketbaseCalendar.fixture";
const require = createRequire(import.meta.url);
const { nextDue } = require("../../../pocketbase/pb_hooks/lib/recurringDue.js");
const calendar = require("../../../pocketbase/pb_hooks/lib/calendar.js");
installPocketBaseCalendar();
afterAll(() => vi.unstubAllGlobals());
const rule = (cadence: string, due_day = 0, due_time = "20:00") => ({
  getString: (key: string) => ({ type: "recurring", cadence, due_time })[key as "type" | "cadence" | "due_time"] ?? "",
  getInt: () => due_day,
});
function due(cadence: string, now: string, day = 0, zone = "America/Los_Angeles", time = "20:00") {
  const hh = { getString: () => zone };
  return calendar.instantUtc(hh, new Date(nextDue(rule(cadence, day, time), calendar.wallUtc(hh, new Date(now))))).toISOString();
}
describe("recurring assignment deadline calculation", () => {
  it("uses today's daily deadline before it and tomorrow's at the exact boundary", () => {
    expect(due("daily", "2026-11-06T19:00:00Z")).toBe("2026-11-07T04:00:00.000Z");
    expect(due("daily", "2026-11-07T04:00:00Z")).toBe("2026-11-08T04:00:00.000Z");
  });
  it("selects the weekly weekday and advances a full week after its deadline", () => {
    expect(due("weekly", "2026-11-03T19:00:00Z", 2)).toBe("2026-11-04T04:00:00.000Z");
    expect(due("weekly", "2026-11-04T04:00:00Z", 2)).toBe("2026-11-11T04:00:00.000Z");
  });
  it.each([
    ["2026-02-02T12:00:00Z", "2026-03-01T04:00:00.000Z"],
    ["2028-02-02T12:00:00Z", "2028-03-01T04:00:00.000Z"],
    ["2026-04-30T03:00:00Z", "2026-05-01T03:00:00.000Z"],
    ["2026-12-31T04:01:00Z", "2027-01-01T04:00:00.000Z"],
  ])("clamps month-end without skipping the target month (%s)", (now, expected) => {
    expect(due("monthly", now, 31)).toBe(expected);
  });
  it("advances to next month after the clamped deadline", () => {
    expect(due("monthly", "2026-03-01T04:00:00Z", 31)).toBe("2026-04-01T03:00:00.000Z");
  });
  it("keeps household wall time through both DST transitions", () => {
    expect(due("daily", "2026-03-08T05:00:00Z")).toBe("2026-03-09T03:00:00.000Z");
    expect(due("daily", "2026-11-01T04:00:00Z")).toBe("2026-11-02T04:00:00.000Z");
  });
  it("uses the household zone rather than the process zone", () => {
    expect(due("daily", "2026-11-06T12:00:00Z", 0, "Asia/Tokyo")).toBe("2026-11-07T11:00:00.000Z");
  });
  it("does not inherit the host DST gap in a household without DST", () => {
    expect(due("daily", "2026-03-07T11:00:00Z", 0, "Asia/Tokyo", "02:30")).toBe("2026-03-07T17:30:00.000Z");
  });
  it("does not replace one-off deadlines or add deadlines without a rule", () => {
    expect(nextDue({ getString: () => "oneoff" }, new Date())).toBe("");
    expect(nextDue(rule("daily", 0, ""), new Date())).toBe("");
  });
});
