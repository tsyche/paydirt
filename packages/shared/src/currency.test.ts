import { describe, expect, it } from "vitest";
import { CURRENCY_PRESETS, DEFAULT_CURRENCY_NAME, currencyDisplayName } from "./currency";

describe("currencyDisplayName", () => {
  it("falls back to the default when currency_name is unset", () => {
    expect(currencyDisplayName(undefined)).toBe(DEFAULT_CURRENCY_NAME);
    expect(currencyDisplayName(null)).toBe(DEFAULT_CURRENCY_NAME);
    expect(currencyDisplayName({})).toBe(DEFAULT_CURRENCY_NAME);
  });

  it("falls back to the default when currency_name is blank or whitespace", () => {
    expect(currencyDisplayName({ currency_name: "" })).toBe(DEFAULT_CURRENCY_NAME);
    expect(currencyDisplayName({ currency_name: "   " })).toBe(DEFAULT_CURRENCY_NAME);
  });

  it("trims a custom name", () => {
    expect(currencyDisplayName({ currency_name: "  Karats  " })).toBe("Karats");
  });

  it("passes through a custom name untouched otherwise", () => {
    expect(currencyDisplayName({ currency_name: "GoldCoins" })).toBe("GoldCoins");
  });
});

describe("presets", () => {
  it("offers Grit first as the top pick, then themed suggestions", () => {
    expect(CURRENCY_PRESETS).toEqual(["Grit", "Nuggets", "Gold", "Karats"]);
  });

  it("includes the default name", () => {
    expect(CURRENCY_PRESETS).toContain(DEFAULT_CURRENCY_NAME);
  });
});
