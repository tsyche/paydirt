import { createRequire } from "node:module";
import { afterAll, describe, expect, it, vi } from "vitest";
import { installPocketBaseCalendar } from "./pocketbaseCalendar.fixture";
const require = createRequire(import.meta.url);
const calendar = require("../../../pocketbase/pb_hooks/lib/calendar.js");
installPocketBaseCalendar();
afterAll(() => vi.unstubAllGlobals());
const household = (zone: string) => ({ getString: () => zone });

describe("backend household calendar", () => {
  it("uses Pacific for unset households, including late-night UTC dates", () => {
    const at = new Date("2026-11-04T07:30:00Z");
    expect(calendar.day(household(""), at)).toBe("2026-11-03");
    expect(calendar.midnight(household(""), at).toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });
  it("honors timezone changes and DST midnight boundaries", () => {
    const at = new Date("2026-03-09T06:30:00Z");
    expect(calendar.midnight(household("America/Los_Angeles"), at).toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(calendar.day(household("Asia/Tokyo"), at)).toBe("2026-03-09");
    expect(calendar.midnight(household("Asia/Tokyo"), at).toISOString()).toBe("2026-03-08T15:00:00.000Z");
  });
  it("round-trips household wall time without changing the instant", () => {
    const at = new Date("2026-11-04T07:30:00Z");
    const hh = household("America/Los_Angeles");
    expect(calendar.instant(hh, calendar.wall(hh, at)).toISOString()).toBe(at.toISOString());
  });
});
