import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Dialog, IconButton, Portal, Text } from "react-native-paper";
import { errorMessage, type InboxItem } from "@paydirt/shared";
import { client } from "../lib/client";

/**
 * Appbar bell that opens the user's alert history. Items are only copies of
 * pushes (the real data lives in assignments/ledger/requests), so the owner
 * can delete any of them.
 */
export function InboxButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await client.listInbox(userId));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [userId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await client.deleteInboxItem(id);
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  };

  const clearAll = async () => {
    try {
      await client.clearInbox(userId);
      setItems([]);
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  };

  return (
    <>
      <Appbar.Action icon="bell-outline" onPress={() => setOpen(true)} accessibilityLabel="Alerts" />
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Alerts</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView>
              {error ? <Text style={styles.empty}>{error}</Text> : null}
              {!error && items.length === 0 ? <Text style={styles.empty}>No alerts 🎉</Text> : null}
              {items.map((i) => (
                <View key={i.id} style={styles.row}>
                  <View style={styles.text}>
                    <Text variant="titleSmall">{i.title}</Text>
                    {i.body ? <Text variant="bodyMedium">{i.body}</Text> : null}
                    <Text variant="labelSmall">{new Date(i.created.replace(" ", "T")).toLocaleString()}</Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() => void remove(i.id)}
                    accessibilityLabel={`Dismiss ${i.title}`}
                  />
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => void clearAll()} disabled={items.length === 0}>Clear all</Button>
            <Button onPress={() => setOpen(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollArea: { maxHeight: 420, paddingHorizontal: 0 },
  empty: { padding: 24, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 24, paddingVertical: 6 },
  text: { flex: 1, gap: 2 },
});
