// Appearance: coordinated palette packs + theme mode.
//
// Single source of truth for both surfaces:
//   - apps/mobile builds react-native-paper MD3 themes from these schemes and
//     tints its surfaces from `tint` via hexMix().
//   - apps/web mirrors the same hex in globals.css `:root[data-palette]` blocks
//     and tints surfaces via color-mix() from --pack-tint (theme.css.test keeps
//     the two in sync — change here, change there).
//
// Unlike a single-accent swap, each pack is a *coordinated mood*: it shifts the
// primary, a complementary secondary, AND a subtle surface tint together, so
// switching repaints the whole screen. Packs were picked to be designer-safe
// (colors that go together) and span earthy → playful → calm. "Paydirt" (green)
// is the default. Choice is stored per-device (AsyncStorage / localStorage).

export type ThemeMode = "system" | "light" | "dark";

export type PaletteId = "goldrush" | "green" | "bubblegum" | "tide" | "slate";

/** Primary + secondary color tokens overridden per pack, per scheme. */
export interface PaletteScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
}

export interface Palette {
  id: PaletteId;
  /** Human label for the switcher. */
  label: string;
  /** Dot color shown in the switcher (the light-scheme primary). */
  swatch: string;
  /** Hue mixed faintly into the surfaces so the whole mood shifts, not one button. */
  tint: string;
  light: PaletteScheme;
  dark: PaletteScheme;
}

export const DEFAULT_PALETTE: PaletteId = "goldrush";
export const DEFAULT_MODE: ThemeMode = "system";

/** How strongly `tint` washes into surfaces (kept subtle so text stays legible). */
export const TINT_LIGHT = 0.07;
export const TINT_DARK = 0.1;

export const PALETTES: Palette[] = [
  {
    id: "goldrush",
    label: "Goldrush",
    swatch: "#c8911e",
    tint: "#c8911e",
    light: {
      primary: "#8a5a00",
      onPrimary: "#ffffff",
      primaryContainer: "#ffddb0",
      onPrimaryContainer: "#2b1700",
      secondary: "#6f5b40",
      onSecondary: "#ffffff",
      secondaryContainer: "#fadfbc",
      onSecondaryContainer: "#261904",
    },
    dark: {
      primary: "#f4bd6e",
      onPrimary: "#462b00",
      primaryContainer: "#653e00",
      onPrimaryContainer: "#ffddb0",
      secondary: "#ddc3a1",
      onSecondary: "#3e2d16",
      secondaryContainer: "#56432b",
      onSecondaryContainer: "#fadfbc",
    },
  },
  {
    id: "green",
    label: "Paydirt Green",
    swatch: "#2f7d4f",
    tint: "#c79a3e",
    light: {
      primary: "#2f7d4f",
      onPrimary: "#ffffff",
      primaryContainer: "#b7f1cb",
      onPrimaryContainer: "#002113",
      secondary: "#8a6d2f",
      onSecondary: "#ffffff",
      secondaryContainer: "#fbe2a8",
      onSecondaryContainer: "#2a1d00",
    },
    dark: {
      primary: "#5cb87a",
      onPrimary: "#003820",
      primaryContainer: "#005232",
      onPrimaryContainer: "#77db96",
      secondary: "#e6c27a",
      onSecondary: "#3f2e00",
      secondaryContainer: "#5a4420",
      onSecondaryContainer: "#fbe2a8",
    },
  },
  {
    id: "bubblegum",
    label: "Bubblegum",
    swatch: "#6a42a8",
    tint: "#c07cd8",
    light: {
      primary: "#6a42a8",
      onPrimary: "#ffffff",
      primaryContainer: "#ecddff",
      onPrimaryContainer: "#23005c",
      secondary: "#b41d61",
      onSecondary: "#ffffff",
      secondaryContainer: "#ffd9e2",
      onSecondaryContainer: "#3e001d",
    },
    dark: {
      primary: "#d3bbff",
      onPrimary: "#390094",
      primaryContainer: "#5126a0",
      onPrimaryContainer: "#ecddff",
      secondary: "#ffb1c8",
      onSecondary: "#5e1133",
      secondaryContainer: "#7d2949",
      onSecondaryContainer: "#ffd9e2",
    },
  },
  {
    id: "tide",
    label: "Tide",
    swatch: "#1560c4",
    tint: "#4a90d9",
    light: {
      primary: "#1560c4",
      onPrimary: "#ffffff",
      primaryContainer: "#d6e3ff",
      onPrimaryContainer: "#001b3d",
      secondary: "#006a6a",
      onSecondary: "#ffffff",
      secondaryContainer: "#6ff7f6",
      onSecondaryContainer: "#002020",
    },
    dark: {
      primary: "#a9c7ff",
      onPrimary: "#002f64",
      primaryContainer: "#00468c",
      onPrimaryContainer: "#d6e3ff",
      secondary: "#4cdada",
      onSecondary: "#003737",
      secondaryContainer: "#004f4f",
      onSecondaryContainer: "#6ff7f6",
    },
  },
  {
    id: "slate",
    label: "Slate",
    swatch: "#44607a",
    tint: "#6b8095",
    light: {
      primary: "#44607a",
      onPrimary: "#ffffff",
      primaryContainer: "#cce0f9",
      onPrimaryContainer: "#001d33",
      secondary: "#4d6357",
      onSecondary: "#ffffff",
      secondaryContainer: "#d0e8da",
      onSecondaryContainer: "#0a1f15",
    },
    dark: {
      primary: "#a9c8e6",
      onPrimary: "#11324a",
      primaryContainer: "#2c4962",
      onPrimaryContainer: "#cce0f9",
      secondary: "#b3ccbd",
      onSecondary: "#1e352a",
      secondaryContainer: "#354b3f",
      onSecondaryContainer: "#d0e8da",
    },
  },
];

const FALLBACK_PALETTE: Palette =
  PALETTES.find((p) => p.id === DEFAULT_PALETTE) ?? PALETTES[0]!;

export function getPalette(id: PaletteId | string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? FALLBACK_PALETTE;
}

/** Resolve "system" to a concrete scheme given the OS preference. */
export function resolveScheme(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  return mode;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Blend `amount` (0–1) of `tint` into `base`; returns `base` if either is non-hex. */
export function hexMix(base: string, tint: string, amount: number): string {
  const b = parseHex(base);
  const t = parseHex(tint);
  if (!b || !t) return base;
  const ch = (x: number, y: number) => Math.round(x + (y - x) * amount);
  const r = ch(b.r, t.r);
  const g = ch(b.g, t.g);
  const bl = ch(b.b, t.b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}
