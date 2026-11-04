import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { windowState, validate } = require("../../../pocketbase/pb_hooks/lib/grantWindows.js");
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
    expect(() => validate(record("06:00-08:00,07:00-09:00"))).toThrow();
    expect(() => validate(record("06:00-08:00,"))).toThrow();
  });
});
