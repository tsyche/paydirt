import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import type { Assignment, Chore, User } from "@paydirt/shared";
import { REACTIONS, errorMessage, undoApprovalPrompt } from "@paydirt/shared";
import { client } from "../lib/client";

type Expanded = Assignment & { expand?: { chore?: Chore; child?: User } };

/** Latest approved chores: send the kid an emoji reaction, or undo the approval. */
export function RecentlyApproved({
  householdId,
  currencyName,
  reloadKey,
  onChanged,
  onMessage,
}: {
  householdId: string;
  currencyName: string;
  /** Bump to refetch (parent pull-to-refresh). */
  reloadKey: number;
  onChanged: () => void;
  onMessage: (msg: string) => void;
}) {
  const theme = useTheme();
  const [items, setItems] = useState<Expanded[]>([]);

  const load = useCallback(async () => {
    try {
      setItems((await client.listRecentlyApproved(householdId, 8)) as Expanded[]);
    } catch {
      // Offline banner already covers connectivity; keep the last list.
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  async function run(fn: () => Promise<unknown>, done: string) {
    try {
      await fn();
      onMessage(done);
      await load();
      onChanged();
    } catch (e) {
      onMessage(errorMessage(e));
    }
  }

  function confirmUndo(a: Expanded) {
    const prompt = undoApprovalPrompt(
      a.expand?.chore?.name,
      a.expand?.chore?.reward,
      a.expand?.child?.display_name,
      currencyName,
    );
    Alert.alert("Undo approval", prompt, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => void run(() => client.undoApproval(a.id), "Approval undone.") },
    ]);
  }

  if (items.length === 0) return null;

  return (
    <>
      <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        RECENTLY APPROVED
      </Text>
      {items.map((a) => (
        <Card key={a.id} style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">{a.expand?.chore?.name ?? "Chore"}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {a.expand?.child?.display_name ?? "child"} · +{a.expand?.chore?.reward ?? "?"} {currencyName}
            </Text>
            <View style={styles.actions}>
              <View style={styles.reactions}>
                {a.reaction ? (
                  <Text style={styles.reacted}>{a.reaction}</Text>
                ) : (
                  REACTIONS.map((emoji) => (
                    <Button
                      key={emoji}
                      compact
                      mode="text"
                      accessibilityLabel={`React ${emoji}`}
                      onPress={() => void run(() => client.reactToAssignment(a.id, emoji), "Reaction sent")}
                      style={styles.emojiBtn}
                      labelStyle={styles.emoji}
                    >
                      {emoji}
                    </Button>
                  ))
                )}
              </View>
              <Button compact textColor={theme.colors.error} onPress={() => confirmUndo(a)}>
                Undo
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 6, letterSpacing: 1, fontSize: 11 },
  card: { borderRadius: 16 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  reactions: { flexDirection: "row" },
  emojiBtn: { minWidth: 0 },
  emoji: { fontSize: 20 },
  reacted: { fontSize: 22, paddingLeft: 8 },
});
