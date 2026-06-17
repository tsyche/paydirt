import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Tone = "primary" | "secondary" | "danger";

/** Darken a #rrggbb hex toward black by `amount` (0–1) for the pressable lip. */
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = 1 - amount;
  const r = Math.round(((n >> 16) & 0xff) * f);
  const g = Math.round(((n >> 8) & 0xff) * f);
  const b = Math.round((n & 0xff) * f);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * PayDirt's signature tactile button: a filled face sitting on a darker bottom
 * "lip" that physically presses down on tap. The playful depth cue (à la
 * Duolingo) that sets PayDirt apart from flat Material buttons. Use for the
 * hero actions — Mark done, Approve.
 */
export function ChunkyButton({
  label,
  onPress,
  icon,
  tone = "primary",
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: Tone;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const fill =
    tone === "danger"
      ? theme.colors.error
      : tone === "secondary"
        ? theme.colors.secondaryContainer
        : theme.colors.primary;
  const ink =
    tone === "danger"
      ? theme.colors.onError
      : tone === "secondary"
        ? theme.colors.onSecondaryContainer
        : theme.colors.onPrimary;
  const lip = darken(fill, 0.4);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.wrap, { backgroundColor: disabled ? theme.colors.surfaceDisabled : lip, opacity: disabled ? 0.6 : 1 }, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            { backgroundColor: fill, transform: [{ translateY: pressed && !disabled ? LIP : 0 }] },
          ]}
        >
          {icon ? <MaterialCommunityIcons name={icon} size={20} color={ink} /> : null}
          <Text style={[styles.label, { color: ink }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const LIP = 4;

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, paddingBottom: LIP },
  face: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { fontFamily: "Fredoka_600SemiBold", fontSize: 16, letterSpacing: 0.2 },
});
