import { Image, View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { ChunkyButton } from "./ChunkyButton";
import { useCountUp } from "../lib/useCountUp";

/**
 * The "claim" — PayDirt's signature balance hero. A kid's parentBucks struck
 * like gold: a big rounded display number on the kid's own accent band. This is
 * the one thing on screen that should feel like treasure, so everything else
 * stays quiet around it.
 *
 * When `animated` is on and the balance ticks up (an approval landed), the
 * number counts up from the old value — the XP-style payoff. Reduced-motion and
 * `animated={false}` (calm mode) jump straight to the new value.
 */
export function ClaimHero({
  name,
  avatar,
  avatarUri,
  balance,
  currencyName,
  dollarValue,
  toDoLabel,
  accent,
  onSpend,
  animated = false,
}: {
  name: string;
  avatar: string;
  /** Uploaded image; shown instead of the emoji when set. */
  avatarUri?: string;
  balance: number;
  currencyName: string;
  dollarValue: string | null;
  toDoLabel: string;
  accent: string;
  onSpend?: () => void;
  /** Count the number up when the balance increases. Off in calm mode. */
  animated?: boolean;
}) {
  const theme = useTheme();
  const shown = useCountUp(balance, animated);
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
      <View style={[styles.header, { backgroundColor: accent }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={styles.avatar}>{avatar}</Text>
        )}
        <Text style={styles.headerName}>{name}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
          Your {currencyName}
        </Text>
        <View style={styles.amountRow}>
          <Text style={styles.coin}>🪙</Text>
          <Text style={[styles.amount, { color: theme.colors.onSurface }]}>{shown}</Text>
        </View>
        {dollarValue ? (
          <Text style={[styles.dollar, { color: theme.colors.onSurfaceVariant }]}>
            ≈ ${dollarValue}
          </Text>
        ) : null}
        <Text style={[styles.todo, { color: theme.colors.onSurfaceVariant }]}>{toDoLabel}</Text>
        {onSpend ? (
          <ChunkyButton
            label="Ask to spend"
            icon="cash-multiple"
            tone="secondary"
            onPress={onSpend}
            style={styles.spend}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: { fontSize: 34 },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  headerName: { fontFamily: "Fredoka_600SemiBold", fontSize: 20, color: "#ffffff" },
  body: { paddingHorizontal: 20, paddingVertical: 18, alignItems: "center" },
  label: { fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase" },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  coin: { fontSize: 40 },
  amount: { fontFamily: "Fredoka_700Bold", fontSize: 64, lineHeight: 72 },
  dollar: { fontFamily: "Fredoka_500Medium", fontSize: 17, marginTop: -4 },
  todo: { fontSize: 14, marginTop: 8, marginBottom: 14 },
  spend: { alignSelf: "stretch" },
});
