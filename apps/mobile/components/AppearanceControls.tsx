import { View, StyleSheet, Pressable } from "react-native";
import { Text, SegmentedButtons, useTheme } from "react-native-paper";
import { PALETTES, type ThemeMode } from "@paydirt/shared";
import { useAppearance } from "../lib/appearance";

/**
 * Live appearance switcher: a row of palette dots + a System/Light/Dark
 * segmented control. Both apply instantly — the Paper theme rebuilds on change.
 */
export function AppearanceControls() {
  const theme = useTheme();
  const { paletteId, mode, setPalette, setMode } = useAppearance();

  return (
    <View style={styles.container}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Color
      </Text>
      <View style={styles.dots}>
        {PALETTES.map((p) => {
          const selected = p.id === paletteId;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPalette(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} color theme`}
              accessibilityState={{ selected }}
              style={[
                styles.dot,
                { backgroundColor: p.swatch },
                selected && { borderColor: theme.colors.onSurface, borderWidth: 3 },
              ]}
            />
          );
        })}
      </View>

      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
        Appearance
      </Text>
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => setMode(v as ThemeMode)}
        density="small"
        buttons={[
          { value: "system", label: "System", icon: "cellphone" },
          { value: "light", label: "Light", icon: "white-balance-sunny" },
          { value: "dark", label: "Dark", icon: "weather-night" },
        ]}
        style={styles.segmented}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  dots: { flexDirection: "row", gap: 14, marginTop: 6, flexWrap: "wrap" },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: "transparent",
    borderWidth: 3,
  },
  segmented: { marginTop: 6 },
});
