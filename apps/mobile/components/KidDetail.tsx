import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import {
  Appbar,
  Card,
  Text,
  Chip,
  ProgressBar,
  Portal,
  Dialog,
  Switch,
  TextInput,
  Button,
  IconButton,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Chore, Household, SavingsGoal, User } from "@paydirt/shared";
import { GOAL_NAME_MAX, GOAL_DETAILS_MAX, KUDOS_REASON_MAX, avatarUrl, currencyDisplayName, featureTip, errorMessage, kidAccent, kudosDefaultBucks, payLabel, effectiveGoodsRate } from "@paydirt/shared";
import { client } from "../lib/client";
import { isNetworkError } from "../lib/reachability";
import { useReachability } from "../lib/useReachability";
import { ClaimHero } from "./ClaimHero";
import { DeliveryOverrides } from "./DeliveryOverrides";
import { ChunkyButton } from "./ChunkyButton";
import { KidAppearanceCard } from "./KidAppearanceCard";
import { changeAvatar } from "../lib/uploadAvatar";
import { OfflineBanner } from "./OfflineBanner";

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
  onOpenLedger,
}: {
  kidId: string;
  household: Household | null;
  onClose: () => void;
  onOpenLedger?: (kidId: string) => void;
}) {
  const theme = useTheme();
  const [kid, setKid] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Expanded[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [history, setHistory] = useState<Expanded[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState("");
  const [tipKey, setTipKey] = useState<string | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [timeBonus, setTimeBonus] = useState(false);
  const [bonusRequestKey, setBonusRequestKey] = useState("");
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [kudosOpen, setKudosOpen] = useState(false);
  const [kudosAmount, setKudosAmount] = useState("");
  const [kudosReason, setKudosReason] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [openGoal, setOpenGoal] = useState<string | null>(null);
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDetails, setGoalDetails] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(true);

  const currencyName = currencyDisplayName(household);
  const goodsRate = effectiveGoodsRate(kid?.goods_rate, household?.goods_rate);
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
      // Network failures already surface via the offline banner — an extra
      // toast on top would just be noise. Anything else still gets one.
      if (!isNetworkError(e)) setSnack(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [kidId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Retry automatically on reconnect instead of waiting for pull-to-refresh.
  const reachable = useReachability();
  const wasReachable = useRef(reachable);
  useEffect(() => {
    if (reachable === "online" && wasReachable.current === "offline") void reload();
    wasReachable.current = reachable;
  }, [reachable, reload]);

  function openAdjust(sign: 1 | -1) {
    setTimeBonus(false);
    setBonusRequestKey(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
      if (timeBonus) await client.giveBonusMinutes(kidId, n, reason, bonusRequestKey);
      else await client.adjustBalance(kidId, adjustSign * n, reason.trim() || "Manual adjustment");
      setAdjustOpen(false);
      setSnack(adjustSign > 0 ? "Bonus added 🎉" : "Deducted.");
      await reload();
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function openKudos() {
    setKudosAmount(String(kudosDefaultBucks(household)));
    setKudosReason("");
    setKudosOpen(true);
  }

  async function saveKudos() {
    const bucks = Number(kudosAmount);
    if (!(bucks > 0)) return;
    setSaving(true);
    try {
      await client.giveKudos(kidId, bucks, kudosReason);
      setKudosOpen(false);
      setSnack("Kudos sent ⭐");
      await reload();
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveGoal() {
    const target = Math.floor(Number(goalTarget));
    if (!goalName.trim() || !(target > 0)) return;
    setSaving(true);
    try {
      await client.createGoal(kidId, goalName.trim(), target, 0, goalDetails);
      setGoalOpen(false);
      setGoalName("");
      setGoalTarget("");
      setGoalDetails("");
      setSnack("Goal added 🎯");
      await reload();
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function removeGoal(g: SavingsGoal) {
    Alert.alert("Delete goal", `Delete the "${g.name}" goal? Their balance isn't affected.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          client
            .deleteGoal(g.id)
            .then(() => reload())
            .catch((e) => setSnack(errorMessage(e)));
        },
      },
    ]);
  }

  const accent = kidAccent(kid?.color, theme.colors.primary);
  const toDo = assignments.filter((a) => a.status === "assigned").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction onPress={onClose} />
        <Appbar.Content title={kid?.display_name ?? "Kid"} />
      </Appbar.Header>

      <OfflineBanner />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        {kid && (
          <ClaimHero
            name={kid.display_name}
            avatar={kid.avatar_emoji || "🧒"}
            avatarUri={avatarUrl(client.pb, kid, "100x100")}
            onAvatarPress={() => void changeAvatar(kid.id, setSnack).then((ok) => { if (ok) void reload(); })}
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
          <ChunkyButton label="Kudos" icon="star" onPress={openKudos} style={styles.adjustBtn} />
        </View>
        {kid && <DeliveryOverrides kid={kid} onSaved={reload} />}

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

        <Text
          variant="labelLarge"
          accessibilityRole="button"
          accessibilityState={{ expanded: goalsOpen }}
          onPress={() => setGoalsOpen((v) => !v)}
          style={[styles.section, { color: theme.colors.onSurfaceVariant }]}
        >
          {goalsOpen ? "▾" : "▸"} GOALS {goals.length > 0 ? `(${goals.length})` : ""}
        </Text>
        <Button mode="outlined" icon="flag-plus" onPress={() => setGoalOpen(true)} style={{ alignSelf: "flex-start" }}>
          Set a goal
        </Button>
        {!goalsOpen ? null : goals.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No savings goals yet.</Text>
        ) : (
          goals.map((g) => {
            const progress = g.achieved ? 1 : Math.min((kid?.balance ?? 0) / g.target, 1);
            return (
              <Card key={g.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <Text
                      variant="titleSmall"
                      style={styles.flex}
                      numberOfLines={openGoal === g.id ? undefined : 1}
                      onPress={() => setOpenGoal(openGoal === g.id ? null : g.id)}
                    >
                      {g.achieved ? "🏆 " : ""}{g.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {g.achieved ? "Done!" : `${kid?.balance ?? 0}/${g.target}`}
                    </Text>
                    <IconButton
                      icon="delete-outline"
                      size={18}
                      accessibilityLabel={`Delete goal ${g.name}`}
                      onPress={() => removeGoal(g)}
                      style={{ margin: 0 }}
                    />
                  </View>
                  <ProgressBar progress={progress} style={styles.bar} color={accent} />
                  {openGoal === g.id && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                      {g.details || "No details."}
                    </Text>
                  )}
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
          <>
            {history.slice(0, 3).map((a) => (
              <Card key={a.id} style={styles.card}>
                <Card.Content style={styles.rowBetween}>
                  <Text variant="bodyMedium" style={styles.flex} numberOfLines={1}>
                    {a.expand?.chore?.name ?? "Chore"}{a.reaction ? `  ${a.reaction}` : ""}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: "700" }}>
                    +{a.expand?.chore ? payLabel(a.expand.chore, "", a.credit_percent) : "?"}
                    {a.credit_percent && a.credit_percent < 100 ? ` (${a.credit_percent}%)` : ""}
                  </Text>
                </Card.Content>
              </Card>
            ))}
            {onOpenLedger && (
              <Button mode="text" compact onPress={() => onOpenLedger(kidId)} style={{ alignSelf: "flex-start" }}>
                More in ledger →
              </Button>
            )}
          </>
        )}

        <Text variant="labelLarge" style={[styles.section, { color: theme.colors.onSurfaceVariant }]}>
          SETTINGS
        </Text>

        {kid && (
          <KidAppearanceCard key={`${kid.id}-${kid.avatar ?? ""}`} kid={kid} onSaved={() => void reload()} onMessage={setSnack} />
        )}

        {kid && (
          <DigestCard
            key={`digest-${kid.id}`}
            kid={kid}
            onTip={() => setTipKey("chore_digest")}
            onSaved={() => {
              setSnack("Chore summary times saved");
              void reload();
            }}
            onError={(e) => setSnack(e)}
          />
        )}

        {kid && (
          <Card style={styles.card}>
            <Card.Content style={styles.rowBetween}>
              <View style={styles.flex}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text variant="titleSmall">Calm mode</Text>
                  <IconButton icon="information-outline" size={16} onPress={() => setTipKey("calm_mode")} style={{ margin: 0 }} />
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Quieter home screen: no badge shelf, confetti, or count-up.
                </Text>
              </View>
              <Switch
                value={!!kid.calm_mode}
                onValueChange={(next) =>
                  void client.pb
                    .collection("users")
                    .update(kid.id, { calm_mode: next })
                    .then(() => reload())
                    .catch((e) => setSnack(errorMessage(e)))
                }
              />
            </Card.Content>
          </Card>
        )}

        {kid && (
          <Card style={styles.card}>
            <Card.Content style={styles.rowBetween}>
              <View style={styles.flex}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text variant="titleSmall">Simplified mode</Text>
                  <IconButton icon="information-outline" size={16} onPress={() => setTipKey("simplified_mode")} style={{ margin: 0 }} />
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Bigger buttons and icons, minimal reading.
                </Text>
              </View>
              <Switch
                value={!!kid.simplified_mode}
                onValueChange={(next) =>
                  void client.pb
                    .collection("users")
                    .update(kid.id, { simplified_mode: next })
                    .then(() => reload())
                    .catch((e) => setSnack(errorMessage(e)))
                }
              />
            </Card.Content>
          </Card>
        )}

        {kid && (
          <FamilyLinkCard
            key={kid.id}
            kid={kid}
            onTip={() => setTipKey("fl_ids")}
            onSaved={() => {
              setSnack("Family Link IDs saved");
              void reload();
            }}
            onError={(e) => setSnack(e)}
          />
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={adjustOpen} onDismiss={() => { if (!saving) setAdjustOpen(false); }}>
          <Dialog.Title>{adjustSign > 0 ? "Add bonus" : "Deduct"}</Dialog.Title>
          <Dialog.Content>
            {adjustSign > 0 && <Button disabled={saving} onPress={() => { setTimeBonus(!timeBonus); setAmount(""); }}>
              {timeBonus ? "Switch to grit bonus" : "Switch to bonus screen minutes"}
            </Button>}
            {timeBonus && <Text>5–120 minutes in five-minute steps. Delivery follows the time window; cannot be undone.</Text>}
            <TextInput
              mode="outlined"
              label={timeBonus ? "Bonus minutes" : `Amount (${currencyName})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              autoFocus
            />
            <TextInput
              mode="outlined"
              label="Reason (optional)"
              maxLength={500}
              value={reason}
              onChangeText={setReason}
              style={styles.reasonInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={saving} onPress={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onPress={() => {
              if (timeBonus) Alert.alert("Give bonus time?", `Give ${amount} minutes? This cannot be undone.`, [
                { text: "Cancel", style: "cancel" }, { text: "Give time", onPress: () => void saveAdjust() },
              ]);
              else void saveAdjust();
            }} disabled={saving || !(Number(amount) > 0) || (timeBonus && !(Number(amount) >= 5 && Number(amount) <= 120 && Number(amount) % 5 === 0))}>
              {adjustSign > 0 ? "Add" : "Deduct"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={kudosOpen} onDismiss={() => setKudosOpen(false)}>
          <Dialog.Title>Give kudos to {kid?.display_name ?? "this kid"}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={`Amount (${currencyName})`}
              value={kudosAmount}
              onChangeText={setKudosAmount}
              keyboardType="number-pad"
              autoFocus
            />
            <TextInput
              mode="outlined"
              label="Why? (optional)"
              value={kudosReason}
              onChangeText={setKudosReason}
              maxLength={KUDOS_REASON_MAX}
              multiline
              style={styles.reasonInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setKudosOpen(false)}>Cancel</Button>
            <Button onPress={saveKudos} disabled={saving || !(Number(kudosAmount) > 0)}>
              Give
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={goalOpen} onDismiss={() => setGoalOpen(false)}>
          <Dialog.Title>Set a goal for {kid?.display_name ?? "them"}</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="What are they saving for?" value={goalName} onChangeText={setGoalName} maxLength={GOAL_NAME_MAX} autoFocus />
            <TextInput
              mode="outlined"
              label={`Target (${currencyName})`}
              value={goalTarget}
              onChangeText={setGoalTarget}
              keyboardType="number-pad"
              style={styles.reasonInput}
            />
            <TextInput
              mode="outlined"
              label="Details (optional)"
              value={goalDetails}
              onChangeText={setGoalDetails}
              maxLength={GOAL_DETAILS_MAX}
              multiline
              style={styles.reasonInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setGoalOpen(false)}>Cancel</Button>
            <Button onPress={saveGoal} disabled={saving || !goalName.trim() || !(Number(goalTarget) >= 1)}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={4000}>
        {snack}
      </Snackbar>
      <Portal>
        <Dialog visible={tipKey !== null} onDismiss={() => setTipKey(null)}>
          <Dialog.Title>What is this?</Dialog.Title>
          <Dialog.Content>
            <Text>{tipKey ? featureTip(tipKey) : ""}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTipKey(null)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

/** Per-kid daily "chores today" summary push times (weekday / weekend, HH:MM; blank = off). */
function DigestCard({
  kid,
  onTip,
  onSaved,
  onError,
}: {
  kid: User;
  onTip: () => void;
  onSaved: () => void;
  onError: (e: string) => void;
}) {
  const [weekday, setWeekday] = useState(kid.digest_weekday ?? "");
  const [weekend, setWeekend] = useState(kid.digest_weekend ?? "");
  const [busy, setBusy] = useState(false);
  const valid = (v: string) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

  async function save() {
    if (!valid(weekday) || !valid(weekend)) {
      onError("Use 24-hour HH:MM, like 14:45 (or leave blank)");
      return;
    }
    setBusy(true);
    try {
      await client.pb
        .collection("users")
        .update(kid.id, { digest_weekday: weekday, digest_weekend: weekend });
      onSaved();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text variant="titleSmall">Chore summary push</Text>
          <IconButton icon="information-outline" size={16} onPress={onTip} style={{ margin: 0 }} />
        </View>
        <TextInput dense label="Weekdays (HH:MM)" placeholder="14:45" value={weekday} onChangeText={setWeekday} />
        <TextInput
          dense
          label="Weekends (HH:MM)"
          placeholder="10:00"
          value={weekend}
          onChangeText={setWeekend}
          style={{ marginTop: 8 }}
        />
        <Button mode="contained-tonal" onPress={() => void save()} disabled={busy} style={{ marginTop: 8 }}>
          Save
        </Button>
      </Card.Content>
    </Card>
  );
}

/** Per-kid Family Link target for automatic screen-time grants. */
function FamilyLinkCard({
  kid,
  onTip,
  onSaved,
  onError,
}: {
  kid: User;
  onTip: () => void;
  onSaved: () => void;
  onError: (e: string) => void;
}) {
  const [childId, setChildId] = useState(kid.fl_child_id ?? "");
  const [deviceId, setDeviceId] = useState(kid.fl_device_id ?? "");
  const [open, setOpen] = useState(false); // collapsed so the IDs aren't edited by accident
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await client.pb
        .collection("users")
        .update(kid.id, { fl_child_id: childId.trim(), fl_device_id: deviceId.trim() });
      onSaved();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text variant="titleSmall" style={styles.flex}>Family Link</Text>
          <IconButton icon="information-outline" size={16} onPress={onTip} style={{ margin: 0 }} />
          <IconButton
            icon={open ? "chevron-up" : "chevron-down"}
            size={20}
            accessibilityLabel={open ? "Collapse Family Link" : "Expand Family Link"}
            onPress={() => setOpen((v) => !v)}
            style={{ margin: 0 }}
          />
        </View>
        {open && (
          <>
            <TextInput dense label="Child ID" value={childId} onChangeText={setChildId} autoCapitalize="none" />
            <TextInput
              dense
              label="Device ID"
              value={deviceId}
              onChangeText={setDeviceId}
              autoCapitalize="none"
              style={{ marginTop: 8 }}
            />
            <Button mode="contained-tonal" onPress={() => void save()} disabled={busy} style={{ marginTop: 8 }}>
              Save
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
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
