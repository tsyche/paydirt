import { ArchiveRow, useArchives } from "./ArchiveActions";
import { useCallback } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import type { Assignment, Chore, User } from "@paydirt/shared";
import { REACTIONS, errorMessage, payLabel, payMode, undoApprovalPrompt } from "@paydirt/shared";
import { client } from "../lib/client";
import { useHistoryFeed } from "../lib/useHistoryFeed";

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
  const fetchPage = useCallback((after: Assignment | undefined, limit: number) =>
    client.listApprovedHistoryPage(householdId, after, limit), [householdId]);
  const { version } = useArchives();
  const history = useHistoryFeed(fetchPage, reloadKey + version);
  const items = history.items as Expanded[];

  async function run(fn: () => Promise<unknown>, done: string) {
    try {
      await fn();
      onMessage(done);
      await history.reload();
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

  if (items.length === 0 && !history.busy && !history.error) return null;

  return (
    <>
      <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        RECENTLY APPROVED
      </Text>
      {items.map((a) => (
        <ArchiveRow key={a.id} kind="assignment" id={a.id} label={a.expand?.chore?.name ?? "chore"} onChanged={() => void history.reload()}><Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">{a.expand?.chore?.name ?? "Chore"}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {a.expand?.child?.display_name ?? "child"} · +{a.expand?.chore ? payLabel(a.expand.chore, currencyName, a.credit_percent) : "?"}
              {a.credit_percent && a.credit_percent < 100 ? ` (${a.credit_percent}% credit)` : ""}
            </Text>
            {a.approval_comment ? <Text style={{ marginTop: 8 }}>Feedback: {a.approval_comment}</Text> : null}
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
              {(!a.expand?.chore || payMode(a.expand.chore) === "bucks") && (
                <Button compact textColor={theme.colors.error} onPress={() => confirmUndo(a)}>
                  Undo approval
                </Button>
              )}
            </View>
          </Card.Content>
        </Card></ArchiveRow>
      ))}
      {history.error ? <Text accessibilityRole="alert">{history.error}</Text> : null}
      {history.error ? <Button disabled={history.busy} onPress={() => void history.reload()}>Retry history</Button> : null}
      {history.hasMore ? <Button mode="outlined" loading={history.busy} disabled={history.busy}
        onPress={() => void history.loadMore()}>Show more</Button> : null}
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
