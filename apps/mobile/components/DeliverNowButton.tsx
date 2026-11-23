import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { errorMessage } from "@paydirt/shared";
import { client } from "../lib/client";

export function DeliverNowButton({ id, collection, overridden, onQueued }: {
  id: string; collection: "time_grants" | "spend_requests"; overridden?: boolean; onQueued: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  return <View>
    <Button disabled={busy || accepted || overridden} loading={busy} onPress={() => {
      Alert.alert("Deliver now", "Deliver the remaining minutes now, outside PayDirt's allowed hours? Your regular schedule stays the same. Family Link restrictions still apply.", [
        { text: "Cancel", style: "cancel" },
        { text: "Deliver now", onPress: () => { void (async () => {
          setBusy(true); setError("");
          try { await client.deliverGrantNow(collection, id); setAccepted(true); await onQueued(); }
          catch (e) { setError(errorMessage(e)); }
          finally { setBusy(false); }
        })(); } },
      ]);
    }}>{accepted || overridden ? "Delivery override enabled" : "Deliver now"}</Button>
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
  </View>;
}
