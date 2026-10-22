import { describe, expect, it, vi } from "vitest";

const { NativeModules } = vi.hoisted(() => ({ NativeModules: {} as Record<string, unknown> }));
vi.mock("react-native", () => ({ NativeModules }));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: { document: "/mock" } }));
vi.mock("expo-application", () => ({ nativeBuildVersion: "1" }));

import { parseVersionCode, shouldUpdate } from "./appUpdate";

describe("parseVersionCode", () => {
  it("coerces numbers and strings", () => {
    expect(parseVersionCode(2)).toBe(2);
    expect(parseVersionCode("3")).toBe(3);
    expect(parseVersionCode("abc")).toBe(0);
    expect(parseVersionCode(null)).toBe(0);
    expect(parseVersionCode(2.9)).toBe(2);
  });
});

describe("shouldUpdate", () => {
  it("true when latest is greater", () => {
    expect(shouldUpdate(1, 2)).toBe(true);
  });
  it("false when equal or older", () => {
    expect(shouldUpdate(2, 2)).toBe(false);
    expect(shouldUpdate(3, 2)).toBe(false);
  });
});
