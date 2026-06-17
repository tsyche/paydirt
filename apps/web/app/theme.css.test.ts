import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, PALETTES, type PaletteScheme } from "@paydirt/shared";

// Guards the promise made in globals.css + theme.ts: the web palette CSS is a
// hand-mirror of the shared registry. If someone tweaks a hex in one place and
// not the other, this fails instead of the two surfaces quietly diverging.

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

const VAR: Record<keyof PaletteScheme, string> = {
  primary: "--md-primary",
  onPrimary: "--md-on-primary",
  primaryContainer: "--md-primary-container",
  onPrimaryContainer: "--md-on-primary-container",
  secondary: "--md-secondary",
  onSecondary: "--md-on-secondary",
  secondaryContainer: "--md-secondary-container",
  onSecondaryContainer: "--md-on-secondary-container",
};

function selector(paletteId: string, scheme: "light" | "dark"): string {
  // The default pack lives on the bare :root; the rest in [data-palette] blocks.
  if (paletteId === DEFAULT_PALETTE) {
    return scheme === "dark" ? ':root[data-theme="dark"]' : ":root";
  }
  return scheme === "dark"
    ? `:root[data-theme="dark"][data-palette="${paletteId}"]`
    : `:root[data-palette="${paletteId}"]`;
}

function blockBody(sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`No CSS block found for selector: ${sel}`);
  return match[1];
}

describe("web palette CSS mirrors the shared registry", () => {
  for (const palette of PALETTES) {
    for (const scheme of ["light", "dark"] as const) {
      it(`${palette.id} / ${scheme}`, () => {
        const body = blockBody(selector(palette.id, scheme));
        const expected = palette[scheme];
        for (const key of Object.keys(VAR) as (keyof PaletteScheme)[]) {
          const re = new RegExp(`${VAR[key]}:\\s*${expected[key]}\\b`, "i");
          expect(body, `${palette.id}/${scheme} ${VAR[key]}`).toMatch(re);
        }
      });
    }
  }
});
