import { describe, expect, it } from "vitest";
import { formatTime12, formatTimeRange, isTime, parseTimeRange, timeRangeError } from "./timeRange";

describe("time range helpers", () => {
  it("validates 24-hour times", () => {
    expect(isTime("00:00")).toBe(true);
    expect(isTime("23:59")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("7:30")).toBe(false);
    expect(isTime("")).toBe(false);
  });

  it("parses and formats ranges, including ones that cross midnight", () => {
    expect(parseTimeRange("15:30-20:00")).toEqual({ start: "15:30", end: "20:00" });
    expect(parseTimeRange("22:00-06:00")).toEqual({ start: "22:00", end: "06:00" });
    expect(parseTimeRange("")).toBeNull();
    expect(parseTimeRange("all")).toBeNull();
    expect(parseTimeRange("15:30-")).toBeNull();
    expect(parseTimeRange("15:30-20:00-21:00")).toBeNull();
    expect(formatTimeRange("15:30", "20:00")).toBe("15:30-20:00");
  });

  it("stays blank until both ends are picked", () => {
    expect(formatTimeRange("15:30", "")).toBe("");
    expect(formatTimeRange("", "20:00")).toBe("");
  });

  it("reports the problems the server would reject", () => {
    expect(timeRangeError("")).toBe("");
    expect(timeRangeError("15:30-20:00")).toBe("");
    expect(timeRangeError("all")).toMatch(/both/);
    expect(timeRangeError("all", true)).toBe("");
    expect(timeRangeError("08:00-08:00")).toMatch(/same/);
    expect(timeRangeError("bogus")).toMatch(/both/);
  });

  it("formats 12-hour display, including midnight and noon", () => {
    expect(formatTime12("00:05")).toBe("12:05 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("15:30")).toBe("3:30 PM");
    expect(formatTime12("nope")).toBe("nope");
  });
});
