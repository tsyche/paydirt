import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from "react-native-paper";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  TINT_DARK,
  TINT_LIGHT,
  getPalette,
  hexMix,
  resolveScheme,
  type PaletteId,
  type ThemeMode,
} from "@paydirt/shared";

const PALETTE_KEY = "paydirt-palette";
const MODE_KEY = "paydirt-mode";

interface Appearance {
  paletteId: PaletteId;
  mode: ThemeMode;
  scheme: "light" | "dark";
  theme: MD3Theme;
  setPalette: (id: PaletteId) => void;
  setMode: (mode: ThemeMode) => void;
}

const AppearanceContext = createContext<Appearance | null>(null);

// Fredoka (rounded display face) carries PayDirt's playful identity. Apply it to
// the prominent MD3 variants — display/headline/title — and leave body/label on
// the system font so dense content stays crisp and native. RN needs the exact
// per-weight family name (it won't synthesize weight from a base family).
const DISPLAY_FONT = "Fredoka_600SemiBold";
const TITLE_FONT = "Fredoka_500Medium";

function brandFonts(base: MD3Theme["fonts"]): MD3Theme["fonts"] {
  const entries = Object.entries(base).map(([key, value]) => {
    if (typeof value !== "object" || value === null) return [key, value];
    if (/^(display|headline)/.test(key)) {
      return [key, { ...value, fontFamily: DISPLAY_FONT, fontWeight: "normal" }];
    }
    if (/^title/.test(key)) {
      return [key, { ...value, fontFamily: TITLE_FONT, fontWeight: "normal" }];
    }
    return [key, value];
  });
  return Object.fromEntries(entries) as MD3Theme["fonts"];
}

// Wash the pack's tint faintly through the surfaces (page, cards via elevation,
// surface variant) so switching packs shifts the whole mood — not just buttons.
function tintSurfaces(
  colors: MD3Theme["colors"],
  tint: string,
  amount: number,
): MD3Theme["colors"] {
  const mix = (c: string) => hexMix(c, tint, amount);
  return {
    ...colors,
    background: mix(colors.background),
    surface: mix(colors.surface),
    surfaceVariant: mix(colors.surfaceVariant),
    elevation: {
      level0: mix(colors.elevation.level0),
      level1: mix(colors.elevation.level1),
      level2: mix(colors.elevation.level2),
      level3: mix(colors.elevation.level3),
      level4: mix(colors.elevation.level4),
      level5: mix(colors.elevation.level5),
    },
  };
}

function buildTheme(paletteId: PaletteId, scheme: "light" | "dark"): MD3Theme {
  const base = scheme === "dark" ? MD3DarkTheme : MD3LightTheme;
  const pack = getPalette(paletteId);
  const merged = { ...base.colors, ...pack[scheme] };
  const amount = scheme === "dark" ? TINT_DARK : TINT_LIGHT;
  return {
    ...base,
    colors: tintSurfaces(merged, pack.tint, amount),
    fonts: brandFonts(base.fonts),
  };
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [paletteId, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);

  // Restore the saved choices once on mount; defaults render until then.
  useEffect(() => {
    void (async () => {
      const [savedPalette, savedMode] = await Promise.all([
        AsyncStorage.getItem(PALETTE_KEY),
        AsyncStorage.getItem(MODE_KEY),
      ]);
      if (savedPalette) setPaletteState(getPalette(savedPalette).id);
      if (savedMode === "system" || savedMode === "light" || savedMode === "dark") {
        setModeState(savedMode);
      }
    })();
  }, []);

  const setPalette = (id: PaletteId) => {
    setPaletteState(id);
    void AsyncStorage.setItem(PALETTE_KEY, id);
  };
  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(MODE_KEY, next);
  };

  const scheme = resolveScheme(mode, systemScheme === "dark");
  const theme = useMemo(() => buildTheme(paletteId, scheme), [paletteId, scheme]);

  const value = useMemo<Appearance>(
    () => ({ paletteId, mode, scheme, theme, setPalette, setMode }),
    [paletteId, mode, scheme, theme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): Appearance {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
