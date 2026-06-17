import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import {
  Appbar,
  Card,
  Text,
  Chip,
  ProgressBar,
  Portal,
  Dialog,
  TextInput,
  Button,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Chore, Household, SavingsGoal, User } from "@paydirt/shared";
import { client } from "../lib/client";
import { ClaimHero } from "./ClaimHero";
import { ChunkyButton } from "./ChunkyButton";

type Expanded = Assignment & { expand?: { chore?: Chore } };

const STATUS_LABEL: Record<string, string> = {
  assigned: "To do",
  completed: "Waiting",
  approved: "Approved",
  rejected: "Try again",
};

/**
 * Parent's per-kid drill-in: one child at a time. The claim hero up top, a quick
 * bonus/deduct, then their active chores, goals, and recent earnings — so a
 * parent can see exactly where a kid stands without scanning the whole family.
 */
export function KidDetail({
  kidId,
  household,
  onClose,
}: {
  kidId: string;
  household: Household | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [kid, setKid] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Expanded[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [history, setHistory] = useState<Expanded[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const currencyName = household?.currency_name?.trim() || "parentBucks";
  const goodsRate = kid?.goods_rate ?? household?.goods_rate ?? 0;
  const dollarValue =
    kid && goodsRate > 0 ? (kid.balance / goodsRate).toFixed(2) : null;

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [freshKid, list, gs, hist] = await Promise.all([
        client.pb.collection("users").getOne<User>(kidId),
        client.listActiveAssignmentsForChild(kidId),
        client.listGoals(kidId),
        client.listApprovedHistory(kidId, 25),
      ]);
      setKid(freshKid);
      setAssignments(list as Expanded[]);
      setGoals(gs);
      setHistory(hist as Expanded[]);
    } catch (e) {
      setSnack(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [kidId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openAdjust(sign: 1 | -1) {
    setAdjustSign(sign);
    setAmount("");
    setReason("");
    setAdjustOpen(true);
  }

  async function saveAdjust() {
    const n = Number(amount);
    if (!(n > 0)) return;
    setSaving(true);
    try {
      await client.adjustBalance(kidId, adjustSign * n, reason.trim() || "Manual adjustment");
      setAdjustOpen(false);
      setSnack(adjustSign > 0 ? "Bonus added 🎉" : "Deducted.");
      await reload();
    } catch (e) {
      setSnack(String(e));
    } finally {
      setSaving(false);
    }
  }

  const accent = kid?.color ?? theme.colors.primary;
  const toDo = assignments.filter((a) => a.status === "assigned").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={onClose} />
        <Appbar.Content title={kid?.display_name ?? "Kid"} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        {kid && (
          <ClaimHero
            name={kid.display_name}
            avatar={kid.avatar_emoji || "🧒"}
            balance={kid.balance}
            currencyName={currencyName}
            dollarValue={dollarValue}
            toDoLabel={toDo === 0 ? "No chores in progress" : `${toDo} chore${toDo === 1 ? "" : "s"} in progress`}
            accent={accent}
          />
        )}

        <View style={styles.adjustRow}>
          <ChunkyButton label="Bonus" icon="plus" onPress={() => openAdjust(1)} style={styles.adjustBtn} />
          <ChunkyButton label="Deduct" icon="minus" tone="danger" onPress={() => openAdjust(-1)} style={styles.adjustBtn} />
        </View>

        <Text variant="labelLarge" style={[styles.section, { color: theme.colors.onSurfaceVariant }]}>
          ACTIVE CHORES {assignments.length > 0 ? `(${assignments.length})` : ""}
        </Text>
        {assignments.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>Nothing assigned right now.</Text>
        ) : (
          assignments.map((a) => (
            <Card key={a.id} style={styles.card}>
              <Card.Content style={styles.rowBetween}>
                <Text variant="titleSmall" style={styles.flex}>
                  {a.expand?.chore?.race ? "🏁 " : ""}{a.expand?.chore?.name ?? "Chore"}
                </Text>
                <Chip compact>{STATUS_LABEL[a.status] ?? a.status}</Chip>
              </Card.Content>
            </Card>
          ))
        )}

        <Text variant="labelLarge" style={[styles.section, { color: theme.colors.onSurfaceVariant }]}>
          GOALS {goals.length > 0 ? `(${goals.length})` : ""}
        </Text>
        {goals.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No savings goals yet.</Text>
        ) : (
          goals.map((g) => {
            const progress = g.achieved ? 1 : Math.min((kid?.balance ?? 0) / g.target, 1);
            return (
              <Card key={g.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <Text variant="titleSmall">{g.achieved ? "🏆 " : ""}{g.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {g.achieved ? "Done!" : `${kid?.balance ?? 0}/${g.target}`}
                    </Text>
                  </View>
                  <ProgressBar progress={progress} style={styles.bar} color={accent} />
                </Card.Content>
              </Card>
            );
          })
        )}

        <Text variant="labelLarge" style={[styles.section, { color: theme.colors.onSurfaceVariant }]}>
          RECENT EARNINGS
        </Text>
        {history.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No approved chores yet.</Text>
        ) : (
          history.map((a) => (
            <Card key={a.id} style={styles.card}>
              <Card.Content style={styles.rowBetween}>
                <Text variant="bodyMedium" style={styles.flex}>
                  {a.expand?.chore?.name ?? "Chore"}{a.reaction ? `  ${a.reaction}` : ""}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: "700" }}>
                  +{a.expand?.chore?.reward ?? "?"}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={adjustOpen} onDismiss={() => setAdjustOpen(false)}>
          <Dialog.Title>{adjustSign > 0 ? "Add bonus" : "Deduct"}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={`Amount (${currencyName})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              autoFocus
            />
            <TextInput
              mode="outlined"
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              style={styles.reasonInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onPress={saveAdjust} disabled={saving || !(Number(amount) > 0)}>
              {adjustSign > 0 ? "Add" : "Deduct"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={4000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  adjustRow: { flexDirection: "row", gap: 10 },
  adjustBtn: { flex: 1 },
  section: { marginTop: 10, letterSpacing: 1, fontSize: 11 },
  empty: { fontSize: 14, opacity: 0.7 },
  card: { borderRadius: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  flex: { flex: 1 },
  bar: { marginTop: 8, height: 8, borderRadius: 4 },
  reasonInput: { marginTop: 8 },
});
