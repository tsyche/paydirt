import { createRequire } from "node:module";
import { afterAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { windowState, validate } = require("../../../pocketbase/pb_hooks/lib/grantWindows.js");
vi.stubGlobal("BadRequestError", Error);
afterAll(() => vi.unstubAllGlobals());
const record = (value: string) => ({
  getString: (field: string) => field.endsWith("_window") ? value : "",
  collection: () => ({ name: "households" }),
});

describe("multiple grant windows", () => {
  it("opens each range and closes the gap, with exclusive end minutes", () => {
    const household = record("06:00-07:00,14:30-20:00");
    for (const [hours, minutes, open] of [[6, 0, true], [7, 0, false], [14, 29, false], [14, 30, true], [20, 0, false]]) {
      expect(windowState(household, new Date(2026, 10, 4, Number(hours), Number(minutes))).open).toBe(open);
    }
  });
  it("supports midnight ranges alongside daytime ranges", () => {
    const household = record("22:00-02:00,06:00-07:00");
    expect(windowState(household, new Date(2026, 10, 4, 1)).open).toBe(true);
    expect(windowState(household, new Date(2026, 10, 4, 3)).open).toBe(false);
    expect(() => validate(household)).not.toThrow();
  });
  it("rejects overlapping and unfinished ranges", () => {
    expect(() => validate(record("06:00-08:00,07:00-09:00"))).toThrow("cannot overlap");
    expect(() => validate(record("06:00-08:00,"))).toThrow("start and end");
  });
  const schedule = (weekday: string, days: Record<string, string>) => ({
    ...record(weekday),
    getString: (field: string) => field === "grant_day_windows" ? JSON.stringify(days) : field.endsWith("_window") ? weekday : "",
  });
  it("replaces Wednesday without changing the other weekdays", () => {
    const household = schedule("15:00-20:00", { "3": "17:00-20:00" });
    expect(windowState(household, new Date(2026, 10, 4, 16)).open).toBe(false);
    expect(windowState(household, new Date(2026, 10, 4, 17)).open).toBe(true);
    expect(windowState(household, new Date(2026, 10, 5, 16)).open).toBe(true);
    expect(() => validate(household)).not.toThrow();
  });
  it("supports no delivery, all day, and child day overrides", () => {
    const household = schedule("15:00-20:00", { "3": "none", "4": "all" });
    expect(windowState(household, new Date(2026, 10, 4, 17)).open).toBe(false);
    expect(windowState(household, new Date(2026, 10, 5, 3)).open).toBe(true);
    expect(windowState(household, new Date(2026, 10, 4, 17), schedule("", { "3": "all" })).open).toBe(true);
  });
  it("rejects invalid day keys and malformed ranges", () => {
    expect(() => validate(schedule("", { "7": "all" }))).toThrow("valid delivery days");
    expect(() => validate(schedule("", { "3": "broken" }))).toThrow("start and end");
    expect(() => validate(schedule("", { "3": "22:00-02:00,01:00-03:00" }))).toThrow("overlap");
  });
});
