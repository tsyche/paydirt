import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import bag from "../assets/bag.png";

/** Money-bag mark + two-tone "PayDirt" wordmark in the app's display font. */
export function BrandTitle({ size = 28, tagline = false }: { size?: number; tagline?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="PayDirt">
      <Image
        source={bag}
        style={{ width: size * 1.8, height: size * 1.8 }}
        accessibilityIgnoresInvertColors
      />
      <View>
        <Text style={[styles.word, { fontSize: size, color: theme.colors.primary }]}>
          Pay<Text style={styles.dirt}>Dirt</Text>
        </Text>
        {tagline && (
          <Text style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}>DO. THE. THING.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  word: { fontFamily: "Fredoka_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 9, fontWeight: "600", letterSpacing: 2.5, marginTop: -2 },
  dirt: { color: "#d99a12" },
});
