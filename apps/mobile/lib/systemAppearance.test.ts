import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ appearance: {} as { setColorScheme?: (scheme: string) => void } }));
vi.mock("react-native", () => ({ Appearance: boundary.appearance }));
import { syncNativeAppearance } from "./systemAppearance";
beforeEach(() => { delete boundary.appearance.setColorScheme; });
describe("native appearance boundary", () => {
  it("allows browser startup when OS color-scheme control is unavailable", () => {
    expect(() => syncNativeAppearance("system")).not.toThrow();
  });
  it.each(["system", "light", "dark"] as const)("preserves native %s mode", (mode) => {
    const apply = vi.fn(); boundary.appearance.setColorScheme = apply;
    syncNativeAppearance(mode);
    expect(apply).toHaveBeenCalledExactlyOnceWith(mode === "system" ? "unspecified" : mode);
  });
});
