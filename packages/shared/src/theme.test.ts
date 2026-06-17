import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE,
  PALETTES,
  getPalette,
  resolveScheme,
} from "./theme";

describe("getPalette", () => {
  it("returns the matching palette", () => {
    expect(getPalette("tide").id).toBe("tide");
  });

  it("falls back to the default for unknown/empty ids", () => {
    expect(getPalette("nope").id).toBe(DEFAULT_PALETTE);
    expect(getPalette(null).id).toBe(DEFAULT_PALETTE);
    expect(getPalette(undefined).id).toBe(DEFAULT_PALETTE);
  });

  it("ships goldrush as the default and first option", () => {
    expect(DEFAULT_PALETTE).toBe("goldrush");
    expect(PALETTES[0]?.id).toBe("goldrush");
  });
});

describe("resolveScheme", () => {
  it("maps explicit modes straight through", () => {
    expect(resolveScheme("light", true)).toBe("light");
    expect(resolveScheme("dark", false)).toBe("dark");
  });

  it("follows the OS in system mode", () => {
    expect(resolveScheme("system", true)).toBe("dark");
    expect(resolveScheme("system", false)).toBe("light");
  });
});

describe("palette completeness", () => {
  const tokens = [
    "primary",
    "onPrimary",
    "primaryContainer",
    "onPrimaryContainer",
    "secondary",
    "onSecondary",
    "secondaryContainer",
    "onSecondaryContainer",
  ] as const;

  it("every palette defines all tokens for both schemes as hex", () => {
    for (const p of PALETTES) {
      for (const scheme of ["light", "dark"] as const) {
        for (const t of tokens) {
          expect(p[scheme][t], `${p.id}/${scheme}/${t}`).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
    }
  });
});
