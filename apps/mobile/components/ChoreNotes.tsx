import { useState } from "react";
import { Button, Text, View } from "react-native";

/** Plain-text instructions; keep chore cards compact until expanded. */
export function ChoreNotes({ text }: { text?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text?.trim()) return null;
  return (
    <View>
      <Text numberOfLines={expanded ? undefined : 2}>{text}</Text>
      <Button title={expanded ? "Less details" : "More details"} onPress={() => setExpanded(!expanded)} />
    </View>
  );
}
