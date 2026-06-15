import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Alert } from "react-native";
import {
  Appbar,
  Card,
  Text,
  Button,
  TextInput,
  Chip,
  Snackbar,
  Divider,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Chore, Household, SpendRequest, User } from "@paydirt/shared";
import { client } from "../lib/client";

type ExpandedAssignment = Assignment & { expand?: { chore?: Chore; child?: User } };
type ExpandedSpend = SpendRequest & { expand?: { child?: User } };

export function ParentHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  const theme = useTheme();
  const [household, setHousehold] = useState<Household | null>(null);
  const [kids, setKids] = useState<User[]>([]);
  const [approvals, setApprovals] = useState<ExpandedAssignment[]>([]);
  const [spend, setSpend] = useState<ExpandedSpend[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [snack, setSnack] = useState("");

  const currencyName = household?.currency_name?.trim() || "parentBucks";
  const goodsRate = household?.goods_rate ?? 0;

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [hh, k, a, s] = await Promise.all([
        client.getHousehold(user.household),
        client.listChildren(user.household),
        client.listPendingApprovals(user.household),
        client.listPendingSpendRequests(user.household),
      ]);
      setHousehold(hh);
      setKids(k);
      setApprovals(a as ExpandedAssignment[]);
      setSpend(s as ExpandedSpend[]);
    } catch (e) {
      setSnack(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [user.household]);

  useEffect(() => {
    void reload();
    let unsub: (() => void) | undefined;
    let disposed = false;
    client
      .subscribeToDashboardUpdates(user.household, () => void reload())
      .then((fn) => {
        if (disposed) fn();
        else unsub = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsub?.();
    };
  }, [reload, user.household]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) setSnack(ok);
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  };

  function confirmReject(assignmentId: string) {
    Alert.prompt(
      "Reject chore",
      "Reason (optional):",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: (msg: string | undefined) =>
            void act(
              () => client.rejectAssignment(assignmentId, msg ?? ""),
              "Rejected."
            ),
        },
      ],
      "plain-text",
    );
  }

  async function broadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      await client.sendBroadcast(user.household, user.id, broadcastMsg.trim());
      setBroadcastMsg("");
      setSnack("Sent to all kids 📣");
    } catch (e) {
      setSnack(String(e));
    } finally {
      setBroadcasting(false);
    }
  }

  const pendingCount = approvals.length + spend.length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header>
        <Appbar.Content
          title="PayDirt"
          subtitle={pendingCount > 0 ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting` : "All clear 🎉"}
        />
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        {/* Kids overview */}
        {kids.length > 0 && (
          <View style={styles.kidsRow}>
            {kids.map((kid) => (
              <View
                key={kid.id}
                style={[styles.kidChipWrap, { borderLeftColor: kid.color ?? theme.colors.primary }]}
              >
                <Text style={styles.kidAvatar}>{kid.avatar || "🧒"}</Text>
                <View>
                  <Text style={styles.kidName}>{kid.display_name}</Text>
                  <Text style={[styles.kidBalance, { color: theme.colors.primary }]}>
                    {kid.balance} {currencyName}
                    {goodsRate > 0 ? `  ·  $${(kid.balance / goodsRate).toFixed(2)}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Broadcast */}
        <Card style={styles.broadcastCard}>
          <Card.Content style={styles.broadcastContent}>
            <TextInput
              mode="outlined"
              label="Message all kids"
              placeholder="e.g. Dinner in 10 minutes!"
              value={broadcastMsg}
              onChangeText={setBroadcastMsg}
              style={styles.broadcastInput}
              dense
            />
            <Button
              mode="contained-tonal"
              onPress={broadcast}
              disabled={broadcasting || !broadcastMsg.trim()}
              icon="bullhorn"
              style={styles.broadcastBtn}
            >
              Send
            </Button>
          </Card.Content>
        </Card>

        {/* Pending approvals */}
        <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          PENDING APPROVALS {approvals.length > 0 ? `(${approvals.length})` : ""}
        </Text>

        {approvals.length === 0 ? (
          <Text style={[styles.emptyNote, { color: theme.colors.onSurfaceVariant }]}>
            Nothing waiting to approve.
          </Text>
        ) : (
          <>
            {approvals.length > 1 && (
              <Button
                mode="contained"
                icon="check-all"
                style={styles.approveAllBtn}
                onPress={() =>
                  act(
                    () => Promise.all(approvals.map((a) => client.approveAssignment(a.id))).then(() => {}),
                    `Approved all ${approvals.length}! 🎉`
                  )
                }
              >
                Approve all ({approvals.length})
              </Button>
            )}
            {approvals.map((a) => {
              const chore = a.expand?.chore;
              const child = a.expand?.child;
              return (
                <Card key={a.id} style={styles.approvalCard}>
                  <Card.Content>
                    <View style={styles.approvalRow}>
                      <View style={styles.approvalInfo}>
                        <Text variant="titleMedium" style={styles.choreName}>
                          {chore?.name ?? "Chore"}
                        </Text>
                        <View style={styles.approvalMeta}>
                          {child && (
                            <Chip compact style={styles.kidChip}>
                              {child.avatar || "🧒"} {child.display_name}
                            </Chip>
                          )}
                          {chore && (
                            <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.primaryContainer }]}>
                              +{chore.reward} {currencyName}
                            </Chip>
                          )}
                        </View>
                        {a.rejection_message ? (
                          <Text variant="bodySmall" style={[styles.resubNote, { color: theme.colors.onSurfaceVariant }]}>
                            ↩️ Resubmitted — you said: {a.rejection_message}
                          </Text>
                        ) : null}
                        {a.kid_response ? (
                          <Text variant="bodySmall" style={[styles.resubNote, { color: theme.colors.onSurfaceVariant }]}>
                            💬 {a.kid_response}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.approvalActions}>
                      <Button
                        mode="contained"
                        icon="check"
                        onPress={() => act(() => client.approveAssignment(a.id), "Approved! 🎉")}
                        style={styles.approveBtn}
                        contentStyle={styles.actionBtnContent}
                      >
                        Approve
                      </Button>
                      <Button
                        mode="outlined"
                        icon="close"
                        onPress={() => confirmReject(a.id)}
                        style={styles.rejectBtn}
                        contentStyle={styles.actionBtnContent}
                        textColor={theme.colors.error}
                      >
                        Reject
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}

        {/* Spend requests */}
        {spend.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              SPEND REQUESTS ({spend.length})
            </Text>
            {spend.map((s) => {
              const child = s.expand?.child;
              return (
                <Card key={s.id} style={styles.approvalCard}>
                  <Card.Content>
                    <Text variant="titleMedium">{s.description}</Text>
                    <View style={styles.approvalMeta}>
                      {child && (
                        <Chip compact style={styles.kidChip}>
                          {child.avatar || "🧒"} {child.display_name}
                        </Chip>
                      )}
                      <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.secondaryContainer }]}>
                        {s.amount} {currencyName}
                        {goodsRate > 0 ? ` ≈ $${(s.amount / goodsRate).toFixed(2)}` : ""}
                      </Chip>
                    </View>
                    <View style={styles.approvalActions}>
                      <Button
                        mode="contained"
                        icon="check"
                        onPress={() =>
                          act(() => client.approveSpendRequest(s.id, user.id), "Spend approved!")
                        }
                        style={styles.approveBtn}
                        contentStyle={styles.actionBtnContent}
                      >
                        Approve
                      </Button>
                      <Button
                        mode="outlined"
                        icon="close"
                        onPress={() =>
                          act(() => client.denySpendRequest(s.id, user.id), "Spend denied.")
                        }
                        style={styles.rejectBtn}
                        contentStyle={styles.actionBtnContent}
                        textColor={theme.colors.error}
                      >
                        Deny
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={4000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

  kidsRow: { gap: 8 },
  kidChipWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
  },
  kidAvatar: { fontSize: 28 },
  kidName: { fontSize: 14, fontWeight: "700" },
  kidBalance: { fontSize: 13, fontWeight: "600" },

  broadcastCard: { borderRadius: 16 },
  broadcastContent: { gap: 8 },
  broadcastInput: { flex: 1 },
  broadcastBtn: { borderRadius: 12, alignSelf: "flex-end" },

  sectionLabel: { marginTop: 6, letterSpacing: 1, fontSize: 11 },
  emptyNote: { fontSize: 14, opacity: 0.7 },

  approveAllBtn: { borderRadius: 12, marginBottom: 4 },

  approvalCard: { borderRadius: 16 },
  approvalRow: { flexDirection: "row", justifyContent: "space-between" },
  approvalInfo: { flex: 1 },
  choreName: { fontWeight: "700", marginBottom: 6 },
  approvalMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  kidChip: {},
  rewardChip: {},
  resubNote: { marginTop: 4, fontStyle: "italic" },
  approvalActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, borderRadius: 12 },
  rejectBtn: { flex: 1, borderRadius: 12 },
  actionBtnContent: { paddingVertical: 4 },

  divider: { marginVertical: 8 },
});
