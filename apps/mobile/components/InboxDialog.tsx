import { ConversationLink } from "./ChoreConversation";
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView, View } from "react-native";
import { Button, Dialog, Portal, SegmentedButtons, Text } from "react-native-paper";
import { errorMessage, householdDateTime, type InboxItem } from "@paydirt/shared";
import { client } from "../lib/client";
import { ArchiveRow, useArchives } from "./ArchiveActions";
import { ArchiveHistory } from "./ArchiveHistory";

export function InboxDialog({ userId, visible, onDismiss }: { userId: string; visible: boolean; onDismiss: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("alerts");
  const { version } = useArchives();
  const load = useCallback(async () => {
    try { setItems(await client.listInbox(userId)); setError(""); }
    catch (e) { setError(errorMessage(e)); }
  }, [userId]);
  useEffect(() => { if (visible) void load(); }, [visible, load, version]);
  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void client.subscribeToInbox(userId, () => void load()).then((fn) => { if (disposed) fn(); else stop = fn; }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, [visible, userId, load]);
  async function sendTest() {
    try {
      const res = await client.sendTestNotification();
      await load();
      setError(res.sent ? "" : "No notification endpoint registered for this account yet.");
    } catch (e) { setError(errorMessage(e)); }
  }
  return <Portal><Dialog visible={visible} onDismiss={onDismiss}>
    <Dialog.Title>Alerts & history</Dialog.Title>
    <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
      <SegmentedButtons value={tab} onValueChange={setTab} buttons={[{ value: "alerts", label: "Alerts" }, { value: "archived", label: "Archived" }]} />
    </View>
    <Dialog.ScrollArea style={{ maxHeight: 420, paddingHorizontal: 0 }}><ScrollView>
      {tab === "archived" ? <ArchiveHistory /> : <View style={{ padding: 16 }}>
        {!!error && <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => void load()}>Retry</Button></>}
        {!error && !items.length && <Text>No alerts 🎉</Text>}
        {items.map((item) => <ArchiveRow key={item.id} kind="inbox" id={item.id} label={item.title} onChanged={() => void load()}>
          <View style={{ padding: 12, gap: 4 }}>
            <Text variant="titleSmall">{item.title}</Text>
            {!!item.body && <Text>{item.body}</Text>}
            <ConversationLink source={item.source} onOpen={onDismiss} />
            <Text variant="labelSmall">{householdDateTime(item.created)}</Text>
          </View>
        </ArchiveRow>)}
      </View>}
    </ScrollView></Dialog.ScrollArea>
    <Dialog.Actions><Button onPress={() => void sendTest()}>Send test</Button><Button onPress={onDismiss}>Done</Button></Dialog.Actions>
  </Dialog></Portal>;
}

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
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void client.subscribeToInbox(userId, () => void check()).then((stop) => {
      if (disposed) stop(); else unsubscribe = stop;
    }).catch(() => {});
    return () => { disposed = true; clearInterval(t); unsubscribe?.(); };
  }, [check, userId]);
  useEffect(() => {
    if (!dialogOpen) void check();
  }, [dialogOpen, check]);
  const markSeen = useCallback(() => {
    setUnread(false);
    void AsyncStorage.setItem(seenKey(userId), new Date().toISOString()).catch(() => {});
  }, [userId]);
  return { unread, markSeen };
}
