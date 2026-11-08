import { Appearance } from "react-native";
import type { ThemeMode } from "@paydirt/shared";

/** Native OS appearance is optional on browser implementations of React Native. */
export function syncNativeAppearance(mode: ThemeMode): void {
  Appearance.setColorScheme?.(mode === "system" ? "unspecified" : mode);
}
