import { StyleSheet, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import { REPLY_OPTIONS, replyLabel } from "@paydirt/shared";

/** One-tap answers under a parent message. Once sent, shows what was sent instead. */
export function BroadcastReplies({
  sent,
  big = false,
  onReply,
}: {
  /** The code already sent for this message, if any. */
  sent?: string;
  big?: boolean;
  onReply: (code: string) => void;
}) {
  const theme = useTheme();
  if (sent) {
    return (
      <Text variant={big ? "titleMedium" : "bodySmall"} style={[styles.sent, { color: theme.colors.onSurfaceVariant }]}>
        You said {replyLabel(sent)}
      </Text>
    );
  }
  return (
    <View style={styles.row}>
      {REPLY_OPTIONS.map((o) => (
        <Chip
          key={o.code}
          compact={!big}
          onPress={() => onReply(o.code)}
          accessibilityLabel={`Reply ${o.label}`}
          textStyle={big ? { fontSize: 20 } : undefined}
        >
          {big ? o.emoji : `${o.emoji} ${o.label}`}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, justifyContent: "center" },
  sent: { marginTop: 8, textAlign: "center" },
});
