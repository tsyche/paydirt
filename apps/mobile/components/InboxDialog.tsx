import { useCallback, useEffect, useState } from "react";
import { householdDateTime } from "@paydirt/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, IconButton, Portal, Text } from "react-native-paper";
import { errorMessage, type InboxItem } from "@paydirt/shared";
import { client } from "../lib/client";

/**
 * Alert history dialog (opened from the header menu). Items are only copies of
 * pushes (the real data lives in assignments/ledger/requests), so the owner
 * can delete any of them.
 */
export function InboxDialog({ userId, visible, onDismiss }: { userId: string; visible: boolean; onDismiss: () => void }) {
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
    if (visible) void load();
  }, [visible, load]);

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await client.deleteInboxItem(id);
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  };

  // Server pushes to this user's own endpoint; the copy also lands in this list.
  const sendTest = async () => {
    try {
      const res = await client.sendTestNotification();
      setError(res.sent ? "" : "No notification endpoint registered for this account yet.");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const clearAll = () => {
    Alert.alert("Clear all", "Delete every notification in your history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: () => void doClearAll() },
    ]);
  };

  const doClearAll = async () => {
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
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss}>
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
                    <Text variant="labelSmall">{householdDateTime(i.created)}</Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={() =>
                      Alert.alert("Delete notification", "Delete this notification?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => void remove(i.id) },
                      ])
                    }
                    accessibilityLabel={`Dismiss ${i.title}`}
                  />
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => void sendTest()}>Send test</Button>
            <Button onPress={clearAll} disabled={items.length === 0}>Clear all</Button>
            <Button onPress={onDismiss}>Done</Button>
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

const seenKey = (userId: string) => `paydirt.alertsSeen.${userId}`;

/** True when an alert newer than the last time the Alerts dialog was opened exists. Refreshes every minute and on close. */
export function useUnreadAlerts(userId: string, dialogOpen: boolean): { unread: boolean; markSeen: () => void } {
  const [unread, setUnread] = useState(false);
  const check = useCallback(async () => {
    try {
      const [items, seen] = await Promise.all([client.listInbox(userId, 20), AsyncStorage.getItem(seenKey(userId))]);
      const last = Date.parse(seen ?? "") || 0;
      setUnread(items.some((i) => i.type !== "broadcast_sent" && Date.parse(i.created.replace(" ", "T")) > last));
    } catch {
      /* offline: keep the previous dot */
    }
  }, [userId]);
  useEffect(() => {
    void check();
    const t = setInterval(() => void check(), 60_000);
    return () => clearInterval(t);
  }, [check]);
  useEffect(() => {
    if (!dialogOpen) void check();
  }, [dialogOpen, check]);
  const markSeen = useCallback(() => {
    setUnread(false);
    void AsyncStorage.setItem(seenKey(userId), new Date().toISOString()).catch(() => {});
  }, [userId]);
  return { unread, markSeen };
}
