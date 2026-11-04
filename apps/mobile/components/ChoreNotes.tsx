import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

/** Plain-text instructions; keep chore cards compact until expanded. */
export function ChoreNotes({ text }: { text?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text?.trim()) return null;
  return (
    <View style={styles.container}>
      {expanded && <Text variant="bodySmall" style={styles.text}>{text}</Text>}
      <Button
        mode="text"
        compact
        icon={expanded ? "chevron-up" : "text-long"}
        onPress={() => setExpanded(!expanded)}
        style={styles.button}
      >
        {expanded ? "Less details" : "More details"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "flex-start", marginBottom: 4 },
  text: { lineHeight: 20, marginBottom: 2 },
  button: { marginLeft: -8 },
});
