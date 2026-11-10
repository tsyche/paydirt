import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, ScrollView, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { approveTimePrompt, conversationEventLabel, conversationSource, errorMessage, householdDateTime, type ChoreMessage } from "@paydirt/shared";
import { TextInput } from "./TextInput";
import { client } from "../lib/client";
import { useRealtimeResume } from "../lib/useRealtimeResume";
import { chooseTimeReward } from "../lib/chooseTimeReward";
import { takePhotoAndComplete } from "../lib/completeWithPhoto";

type Chore = Awaited<ReturnType<typeof client.getConversationAssignment>>;
type Draft = { body: string; key: string; pending?: boolean };
const Context = createContext<(id: string) => void>(() => {});
export function ConversationButton({ assignmentId }: { assignmentId: string }) {
  const open = useContext(Context);
  return <Button icon="comment-text-outline" contentStyle={{ minHeight: 48 }} onPress={() => open(assignmentId)}>Conversation</Button>;
}
export function ConversationLink({ source, onOpen }: { source?: string; onOpen?: () => void }) {
  const open = useContext(Context), id = conversationSource(source);
  return id ? <Button icon="comment-text-outline" onPress={() => { onOpen?.(); open(id); }}>Open conversation</Button> : null;
}
export function ConversationProvider({ children, userId, notificationRoute }: {
  children: ReactNode; userId?: string; notificationRoute?: { inboxId?: string | null; nonce: number } | null;
}) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!userId || !notificationRoute?.inboxId) return;
    let active = true;
    void client.pb.collection("inbox").getOne(notificationRoute.inboxId).then((item) => {
      const target = conversationSource(item.source); if (active && target) setId(target);
    }).catch(() => {});
    return () => { active = false; };
  }, [notificationRoute, userId]);
  return <Context.Provider value={setId}>{children}{id && userId && <Thread key={`${userId}:${id}`} id={id} userId={userId} close={() => setId(null)} />}</Context.Provider>;
}
function Thread({ id, userId, close }: { id: string; userId: string; close: () => void }) {
  const [assignment, setAssignment] = useState<Chore | null>(null);
  const [messages, setMessages] = useState<ChoreMessage[]>([]);
  const [draft, setDraft] = useState<Draft>({ body: "", key: "" });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const working = useRef(false);
  const storageKey = `paydirt.conversation:${userId}:${id}`;
  const load = useCallback(async () => {
    try {
      const [a, rows] = await Promise.all([client.getConversationAssignment(id), client.listChoreMessages(id)]);
      setAssignment(a); setMessages(rows);
    } catch (e) { setError(errorMessage(e)); }
  }, [id]);
  useRealtimeResume(load, false);
  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((raw) => { if (raw) setDraft(JSON.parse(raw)); setReady(true); }).catch((e) => setError(errorMessage(e)));
    void load(); let active = true, stop: (() => void) | undefined;
    void client.subscribeToConversation(id, () => { void load(); }).then((s) => { if (active) stop = s; else s(); }).catch((e) => setError(errorMessage(e)));
    return () => { active = false; stop?.(); };
  }, [id, storageKey, load]);
  async function save(value: Draft) { await AsyncStorage.setItem(storageKey, JSON.stringify(value)); setDraft(value); }
  async function send(submit = false) {
    if (working.current || !ready || !draft.body.trim()) return;
    working.current = true; setBusy(true); setError("");
    const request = { body: draft.body.trim(), key: draft.key || `${Date.now()}-${Math.random().toString(36).slice(2)}`, pending: !submit };
    try {
      await save(request);
      if (submit && assignment) {
        const choice = await chooseTimeReward(assignment.expand?.chore);
        if (!choice) return;
        if (assignment.expand?.chore?.photo_required || assignment.status === "rejected") {
          const result = await takePhotoAndComplete(id, choice, request.body);
          if (result === "no-permission") throw new Error("Camera permission is needed for this chore.");
          if (result === "cancelled") return;
        } else await client.markComplete(id, undefined, choice, request.body);
      } else await client.sendChoreMessage(id, request.body, request.key);
      await AsyncStorage.removeItem(storageKey); setDraft({ body: "", key: "" }); await load();
    } catch (e) {
      if ([400, 401, 403].includes((e as { status?: number }).status || 0)) await save({ ...request, pending: false });
      setError(errorMessage(e));
    } finally { working.current = false; setBusy(false); }
  }
  async function decide(kind: "approve" | "reject") {
    if (!assignment || working.current) return;
    if (kind === "approve") {
      const prompt = approveTimePrompt([{ chore: assignment.expand?.chore, timeChoice: assignment.time_choice }]);
      if (prompt && !await new Promise<boolean>((resolve) => Alert.alert("Approve chore", prompt, [{ text: "Cancel", onPress: () => resolve(false) }, { text: "Approve", onPress: () => resolve(true) }], { cancelable: false }))) return;
    }
    working.current = true; setBusy(true); setError("");
    try {
      if (kind === "approve") await client.approveAssignment(id); else await client.rejectAssignment(id, reason);
      setRejecting(false); setReason(""); await load();
    } catch (e) { setError(errorMessage(e)); }
    finally { working.current = false; setBusy(false); }
  }
  const parent = client.isParent;
  return <Portal><Dialog visible onDismiss={() => { if (!busy) close(); }}>
    <Dialog.Title>Conversation: {assignment?.expand?.chore?.name || "Chore"}</Dialog.Title>
    <Dialog.ScrollArea style={{ maxHeight: 260 }}><ScrollView keyboardShouldPersistTaps="handled">
      <Text>Status: {assignment?.status || "Loading…"}</Text>
      {!messages.length && <Text>No messages yet. Sending does not approve or reject this chore.</Text>}
      {messages.map((message) => <View key={message.id} style={{ gap: 4, paddingVertical: 10 }}>
        <Text variant="titleSmall">{message.author_name} · {conversationEventLabel(message.kind)}</Text>
        <Text variant="bodySmall">{message.kind === "legacy" ? "Record last updated: " : ""}{householdDateTime(message.created)}</Text>
        {!!message.body && <Text>{message.body}</Text>}
      </View>)}
    </ScrollView></Dialog.ScrollArea>
    <Dialog.Content style={{ gap: 8, paddingTop: 12 }}>
      <TextInput label="Message" accessibilityLabel="Message" style={{ minHeight: 70, maxHeight: 120 }} multiline maxLength={1000} value={draft.body} disabled={busy || !ready || !!draft.pending} onChangeText={(body) => { setDraft({ body, key: "" }); void AsyncStorage.setItem(storageKey, JSON.stringify({ body, key: "" })).catch((e) => setError(errorMessage(e))); }} />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Text variant="bodySmall">Messages stay in this chore's history. Correct with a new reply.</Text>
      {!parent && ["assigned", "rejected"].includes(assignment?.status || "") && <Button disabled={busy || !ready || !draft.body.trim() || !!draft.pending} onPress={() => void send(true)}>Send note and mark done</Button>}
      {parent && assignment?.status === "completed" && <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Button disabled={busy} onPress={() => void decide("approve")}>Approve chore</Button>
        <Button disabled={busy} onPress={() => setRejecting(!rejecting)}>Reject chore</Button>
      </View>}
      {rejecting && <><TextInput label="Reason for return" value={reason} maxLength={500} onChangeText={setReason} /><Button disabled={busy} onPress={() => void decide("reject")}>Confirm rejection</Button></>}
    </Dialog.Content>
    <Dialog.Actions><Button disabled={busy} onPress={close}>Close conversation</Button><Button mode="contained" disabled={busy || !ready || !draft.body.trim()} loading={busy} onPress={() => void send()}>{draft.pending ? "Retry message" : "Send message"}</Button></Dialog.Actions>
  </Dialog></Portal>;
}
