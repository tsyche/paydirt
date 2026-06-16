import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Alert, Image } from "react-native";
import {
  Appbar,
  Card,
  Text,
  Button,
  TextInput,
  Chip,
  Snackbar,
  Divider,
  Switch,
  SegmentedButtons,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Chore, ChoreProposal, Household, SpendRequest, User } from "@paydirt/shared";
import { client } from "../lib/client";

type ExpandedAssignment = Assignment & { expand?: { chore?: Chore; child?: User } };
type ExpandedSpend = SpendRequest & { expand?: { child?: User } };
type ExpandedProposal = ChoreProposal & { expand?: { child?: User } };

export function ParentHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  const theme = useTheme();
  const [household, setHousehold] = useState<Household | null>(null);
  const [kids, setKids] = useState<User[]>([]);
  const [approvals, setApprovals] = useState<ExpandedAssignment[]>([]);
  const [spend, setSpend] = useState<ExpandedSpend[]>([]);
  const [proposals, setProposals] = useState<ExpandedProposal[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [snack, setSnack] = useState("");

  // Create chore form state
  const [showCreateChore, setShowCreateChore] = useState(false);
  const [choreName, setChoreName] = useState("");
  const [choreReward, setChoreReward] = useState("10");
  const [choreType, setChoreType] = useState<"oneoff" | "recurring">("oneoff");
  const [choreCadence, setChoreCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [chorePhoto, setChorePhoto] = useState(false);
  const [choreRace, setChoreRace] = useState(false);
  const [choreReminder, setChoreReminder] = useState("");
  const [creatingChore, setCreatingChore] = useState(false);

  // Assignment state: choreId → Set of selected kidIds
  const [assignSelections, setAssignSelections] = useState<Record<string, Set<string>>>({});
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const currencyName = household?.currency_name?.trim() || "parentBucks";
  const goodsRate = household?.goods_rate ?? 0;

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [hh, k, a, s, c, p] = await Promise.all([
        client.getHousehold(user.household),
        client.listChildren(user.household),
        client.listPendingApprovals(user.household),
        client.listPendingSpendRequests(user.household),
        client.listChores(user.household),
        client.listPendingProposals(user.household),
      ]);
      setHousehold(hh);
      setKids(k);
      setApprovals(a as ExpandedAssignment[]);
      setSpend(s as ExpandedSpend[]);
      setChores(c);
      setProposals(p as ExpandedProposal[]);
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

  function confirmApproveProposal(proposal: ExpandedProposal) {
    Alert.prompt(
      `Reward for "${proposal.name}"?`,
      "parentBucks to award on approval — assigns straight back to the kid who proposed it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: (value: string | undefined) => {
            const reward = Number(value);
            if (!(reward >= 0)) return;
            void act(
              () => client.approveProposal(proposal, user.id, reward),
              "Approved — assigned! 🎉"
            );
          },
        },
      ],
      "plain-text",
      String(proposal.reward_requested),
      "number-pad",
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

  async function createChore() {
    if (!choreName.trim()) return;
    setCreatingChore(true);
    try {
      await client.createChore({
        household: user.household,
        name: choreName.trim(),
        reward: Number(choreReward) || 0,
        type: choreType,
        cadence: choreType === "recurring" ? choreCadence : undefined,
        photo_required: chorePhoto,
        race: choreRace,
        reminder_time: choreReminder.trim() || undefined,
        created_by: user.id,
        active: true,
      });
      setChoreName("");
      setChoreReward("10");
      setChoreType("oneoff");
      setChoreCadence("weekly");
      setChorePhoto(false);
      setChoreRace(false);
      setChoreReminder("");
      setShowCreateChore(false);
      setSnack("Chore created ✅");
      await reload();
    } catch (e) {
      setSnack(String(e));
    } finally {
      setCreatingChore(false);
    }
  }

  function toggleKidForChore(choreId: string, kidId: string) {
    setAssignSelections((prev) => {
      const cur = new Set(prev[choreId] ?? []);
      if (cur.has(kidId)) cur.delete(kidId);
      else cur.add(kidId);
      return { ...prev, [choreId]: cur };
    });
  }

  async function assignChore(choreId: string) {
    const selected = assignSelections[choreId];
    if (!selected || selected.size === 0) return;
    setAssigning((prev) => ({ ...prev, [choreId]: true }));
    try {
      for (const kidId of selected) {
        await client.assignChore(choreId, kidId);
      }
      setAssignSelections((prev) => ({ ...prev, [choreId]: new Set() }));
      setSnack("Assigned ✅");
      await reload();
    } catch (e) {
      setSnack(String(e));
    } finally {
      setAssigning((prev) => ({ ...prev, [choreId]: false }));
    }
  }

  const pendingCount = approvals.length + spend.length + proposals.length;

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
                <Text style={styles.kidAvatar}>{kid.avatar_emoji || "🧒"}</Text>
                <View>
                  <Text style={styles.kidName}>{kid.display_name}</Text>
                  <Text style={[styles.kidBalance, { color: theme.colors.primary }]}>
                    {kid.balance} {currencyName}
                    {(kid.goods_rate ?? goodsRate) > 0 ? `  ·  $${(kid.balance / (kid.goods_rate ?? goodsRate)).toFixed(2)}` : ""}
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

        {/* Chore ideas from kids */}
        {proposals.length > 0 && (
          <>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              CHORE IDEAS ({proposals.length})
            </Text>
            {proposals.map((p) => {
              const kid = p.expand?.child;
              return (
                <Card key={p.id} style={styles.approvalCard}>
                  <Card.Content>
                    <Text variant="titleMedium">
                      💡 {p.name}
                      {p.description ? ` — ${p.description}` : ""}
                    </Text>
                    <View style={styles.approvalMeta}>
                      {kid && (
                        <Chip compact style={styles.kidChip}>
                          {kid.avatar_emoji || "🧒"} {kid.display_name}
                        </Chip>
                      )}
                      <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.secondaryContainer }]}>
                        asks {p.reward_requested} {currencyName}
                      </Chip>
                    </View>
                    <View style={styles.approvalActions}>
                      <Button
                        mode="contained"
                        icon="check"
                        onPress={() => confirmApproveProposal(p)}
                        style={styles.approveBtn}
                        contentStyle={styles.actionBtnContent}
                      >
                        Approve
                      </Button>
                      <Button
                        mode="outlined"
                        icon="close"
                        onPress={() => act(() => client.declineProposal(p.id, user.id), "Declined.")}
                        style={styles.rejectBtn}
                        contentStyle={styles.actionBtnContent}
                        textColor={theme.colors.error}
                      >
                        Decline
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}

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
                              {child.avatar_emoji || "🧒"} {child.display_name}
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
                        {a.photo ? (
                          <Image
                            source={{ uri: client.getPhotoUrl(a) }}
                            style={styles.photoThumb}
                          />
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
                          {child.avatar_emoji || "🧒"} {child.display_name}
                        </Chip>
                      )}
                      <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.secondaryContainer }]}>
                        {s.amount} {currencyName}
                        {(child?.goods_rate ?? goodsRate) > 0 ? ` ≈ $${(s.amount / (child?.goods_rate ?? goodsRate)).toFixed(2)}` : ""}
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
        {/* Chores */}
        <Divider style={styles.divider} />
        <View style={styles.sectionHeader}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            CHORES ({chores.length})
          </Text>
          <Button
            mode="contained-tonal"
            icon={showCreateChore ? "chevron-up" : "plus"}
            onPress={() => setShowCreateChore((v) => !v)}
            compact
          >
            {showCreateChore ? "Cancel" : "Add"}
          </Button>
        </View>

        {showCreateChore && (
          <Card style={styles.createChoreCard}>
            <Card.Content style={styles.createChoreContent}>
              <TextInput
                mode="outlined"
                label="Chore name"
                value={choreName}
                onChangeText={setChoreName}
                dense
              />
              <TextInput
                mode="outlined"
                label="Reward"
                value={choreReward}
                onChangeText={setChoreReward}
                keyboardType="numeric"
                dense
                style={styles.rewardInput}
              />
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Type</Text>
              <SegmentedButtons
                value={choreType}
                onValueChange={(v) => setChoreType(v as "oneoff" | "recurring")}
                buttons={[
                  { value: "oneoff", label: "One-off" },
                  { value: "recurring", label: "Recurring" },
                ]}
                style={styles.segmented}
              />
              {choreType === "recurring" && (
                <>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Cadence</Text>
                  <SegmentedButtons
                    value={choreCadence}
                    onValueChange={(v) => setChoreCadence(v as "daily" | "weekly" | "monthly")}
                    buttons={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                    style={styles.segmented}
                  />
                </>
              )}
              <TextInput
                mode="outlined"
                label="Reminder time (HH:MM, optional)"
                value={choreReminder}
                onChangeText={setChoreReminder}
                keyboardType="numbers-and-punctuation"
                placeholder="e.g. 15:30"
                dense
                style={{ marginTop: 4 }}
              />
              <View style={styles.switchRow}>
                <Text>📷 Photo required</Text>
                <Switch value={chorePhoto} onValueChange={setChorePhoto} />
              </View>
              <View style={styles.switchRow}>
                <Text>🏁 Race (first to finish wins)</Text>
                <Switch value={choreRace} onValueChange={setChoreRace} />
              </View>
              <Button
                mode="contained"
                onPress={createChore}
                disabled={creatingChore || !choreName.trim()}
                style={{ marginTop: 8, borderRadius: 12 }}
                icon="check"
              >
                {creatingChore ? "Creating…" : "Create chore"}
              </Button>
            </Card.Content>
          </Card>
        )}

        {chores.length === 0 && !showCreateChore && (
          <Text style={[styles.emptyNote, { color: theme.colors.onSurfaceVariant }]}>
            No active chores. Tap Add to create one.
          </Text>
        )}

        {chores.map((chore) => {
          const sel = assignSelections[chore.id] ?? new Set<string>();
          const busy = assigning[chore.id] ?? false;
          return (
            <Card key={chore.id} style={styles.approvalCard}>
              <Card.Content>
                <View style={styles.choreRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                      {chore.race ? "🏁 " : ""}{chore.name}
                      {chore.photo_required ? " 📷" : ""}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {chore.reward} {currencyName} · {chore.type}
                      {chore.cadence ? ` (${chore.cadence})` : ""}
                      {chore.reminder_time ? ` · ⏰ ${chore.reminder_time}` : ""}
                    </Text>
                  </View>
                </View>
                {kids.length > 0 && (
                  <View style={styles.assignRow}>
                    {kids.map((kid) => (
                      <Chip
                        key={kid.id}
                        selected={sel.has(kid.id)}
                        onPress={() => toggleKidForChore(chore.id, kid.id)}
                        compact
                        style={styles.kidAssignChip}
                      >
                        {kid.avatar_emoji || "🧒"} {kid.display_name}
                      </Chip>
                    ))}
                    <Button
                      mode="contained-tonal"
                      onPress={() => void assignChore(chore.id)}
                      disabled={busy || sel.size === 0}
                      compact
                      style={styles.assignBtn}
                    >
                      Assign
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}

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
  photoThumb: { width: 100, height: 100, borderRadius: 8, marginTop: 8 },
  approvalActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, borderRadius: 12 },
  rejectBtn: { flex: 1, borderRadius: 12 },
  actionBtnContent: { paddingVertical: 4 },

  divider: { marginVertical: 8 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  createChoreCard: { borderRadius: 16, marginTop: 8 },
  createChoreContent: { gap: 6 },
  rewardInput: { width: 120 },
  segmented: { marginTop: 2 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  choreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  assignRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" },
  kidAssignChip: {},
  assignBtn: { borderRadius: 12 },
});
