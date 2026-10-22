import { ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { Badge } from "@paydirt/shared";

/**
 * The badge shelf — earned trophies in full color, plus the next locked badge
 * with its progress so there's always something to reach for. Pure display;
 * computation lives in @paydirt/shared computeBadges.
 */
export function BadgeShelf({ badges }: { badges: Badge[] }) {
  const theme = useTheme();
  const earned = badges.filter((b) => b.earned);
  const next = badges.find((b) => !b.earned);
  const shown = next ? [...earned, next] : earned;
  if (shown.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text variant="labelMedium" style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>
        Badges
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shown.map((b) => (
          <View
            key={b.id}
            style={[
              styles.badge,
              {
                backgroundColor: b.earned
                  ? theme.colors.secondaryContainer
                  : theme.colors.surfaceVariant,
                opacity: b.earned ? 1 : 0.55,
              },
            ]}
          >
            <Text style={styles.icon}>{b.earned ? b.icon : "🔒"}</Text>
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurface, textAlign: "center" }}
            >
              {b.label}
            </Text>
            {b.progress ? (
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {b.progress}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  title: { letterSpacing: 1, textTransform: "uppercase", fontSize: 11, marginBottom: 6 },
  row: { gap: 8, paddingRight: 8 },
  badge: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
    minWidth: 84,
  },
  icon: { fontSize: 28 },
});
