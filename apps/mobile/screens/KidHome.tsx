import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import {
  Appbar,
  Card,
  Text,
  Button,
  Chip,
  IconButton,
  List,
  Portal,
  Dialog,
  ProgressBar,
  TextInput,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Broadcast, Chore, Household, SavingsGoal, User } from "@paydirt/shared";
import { client } from "../lib/client";
import { takePhotoAndComplete } from "../lib/completeWithPhoto";

type Expanded = Assignment & { expand?: { chore?: Chore; child?: User } };

const STATUS_LABEL: Record<string, string> = {
  assigned: "To do",
  completed: "Waiting for approval",
  approved: "Approved",
  rejected: "Try again",
};

function dueInfo(chore?: Chore): { label: string; overdue: boolean } | null {
  if (!chore?.due_at) return null;
  const due = new Date(chore.due_at.replace(" ", "T"));
  const overdue = due.getTime() < Date.now();
  const label = `${overdue ? "Was due" : "Due"} ${due.toLocaleDateString()} ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return { label, overdue };
}

export function KidHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  const theme = useTheme();
  const [me, setMe] = useState<User>(user);
  const [assignments, setAssignments] = useState<Expanded[]>([]);
  const [history, setHistory] = useState<Expanded[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [swapsIn, setSwapsIn] = useState<Expanded[]>([]);
  const [siblings, setSiblings] = useState<User[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [replyFor, setReplyFor] = useState<Expanded | null>(null);
  const [remindFor, setRemindFor] = useState<Expanded | null>(null);
  const [swapFor, setSwapFor] = useState<Expanded | null>(null);
  const [snack, setSnack] = useState("");

  const currencyName = household?.currency_name?.trim() || "parentBucks";

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [freshMe, list, hist, gs, swaps, kids, hh, bcs] = await Promise.all([
        client.pb.collection("users").getOne<User>(user.id),
        client.listActiveAssignmentsForChild(user.id),
        client.listApprovedHistory(user.id, 50),
        client.listGoals(user.id),
        client.listIncomingSwaps(user.id),
        client.listChildren(user.household),
        client.getHousehold(user.household),
        client.getRecentBroadcasts(user.household, 5),
      ]);
      setMe(freshMe);
      setAssignments(list as Expanded[]);
      setHistory(hist as Expanded[]);
      setGoals(gs);
      setSwapsIn((swaps as Expanded[]).filter((s) => s.child !== user.id));
      setSiblings(kids.filter((k) => k.id !== user.id));
      setHousehold(hh);
      setBroadcasts(bcs);
    } catch (e) {
      setSnack(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [user.id, user.household]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime: re-fetch when this kid's assignments, goals, or balance change,
  // so approvals show up without pull-to-refresh. Best-effort — if the
  // subscription fails, pull-to-refresh still works.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let disposed = false;
    client
      .subscribeToKidUpdates(user.id, () => void reload())
      .then((u) => {
        if (disposed) u();
        else unsub = u;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsub?.();
    };
  }, [user.id, reload]);

  const act = (fn: () => Promise<unknown>, okMessage?: string) => async () => {
    try {
      await fn();
      if (okMessage) setSnack(okMessage);
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  };

  async function markDone(id: string) {
    await act(() => client.markComplete(id), "Marked done — waiting for approval!")();
  }

  async function markDoneWithPhoto(id: string, resubmit = false) {
    try {
      const result = await takePhotoAndComplete(id);
      if (result === "no-permission") {
        setSnack("Camera permission needed to submit this chore.");
        return;
      }
      if (result === "cancelled") return;
      setSnack(resubmit ? "Sent back for another look!" : "Marked done — waiting for approval!");
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  }

  const toDo = assignments.filter((a) => a.status === "assigned");
  const streak = me.streak_count ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header>
        <Appbar.Content title={`Hi, ${user.display_name}`} />
        {streak >= 2 ? <Chip compact style={styles.streakChip}>{`🔥 ${streak}-day streak`}</Chip> : null}
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        <Card style={styles.balanceCard}>
          <Card.Content>
            <Text variant="labelLarge">Your {currencyName}</Text>
            <Text variant="displaySmall" style={styles.balance}>
              {me.balance}
            </Text>
            {(household?.goods_rate ?? 0) > 0 ? (
              <Text variant="bodyMedium" style={styles.dollarValue}>
                ${(me.balance / household!.goods_rate!).toFixed(2)}
              </Text>
            ) : null}
            <Text variant="bodySmall" style={styles.todoLine}>
              {toDo.length === 0 ? "Nothing to do — go play! 🎉" : `${toDo.length} chore${toDo.length === 1 ? "" : "s"} to do`}
            </Text>
            <Button mode="contained-tonal" onPress={() => setSpendOpen(true)}>
              Ask to spend
            </Button>
          </Card.Content>
        </Card>

        {swapsIn.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.heading}>
              Swap offers 🔄
            </Text>
            {swapsIn.map((a) => (
              <Card key={a.id} style={styles.choreCard}>
                <Card.Content>
                  <Text variant="titleMedium">{a.expand?.chore?.name ?? "Chore"}</Text>
                  <Text variant="bodySmall">
                    {a.expand?.child?.display_name ?? "Someone"} wants you to take this
                    {a.expand?.chore ? ` (+${a.expand.chore.reward} ${currencyName})` : ""}
                  </Text>
                  <View style={styles.buttonRow}>
                    <Button mode="contained" onPress={act(() => client.respondToSwap(a, user.id, true), "It's yours now!")}>
                      Take it
                    </Button>
                    <Button mode="outlined" onPress={act(() => client.respondToSwap(a, user.id, false), "Passed.")}>
                      No thanks
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        <View style={styles.headingRow}>
          <Text variant="titleMedium" style={styles.heading}>
            My chores
          </Text>
          <Button compact icon="lightbulb-outline" onPress={() => setProposeOpen(true)}>
            Suggest one
          </Button>
        </View>
        {assignments.length === 0 && <Text>No chores right now. 🎉</Text>}
        {assignments.map((a) => {
          const chore = a.expand?.chore;
          const due = dueInfo(chore);
          const offered = !!a.swap_to;
          return (
            <Card key={a.id} style={styles.choreCard}>
              <Card.Content>
                <View style={styles.choreRow}>
                  <Text variant="titleMedium" style={styles.choreName}>
                    {chore?.race ? "🏁 " : ""}
                    {chore?.name ?? "Chore"}
                  </Text>
                  <Chip compact>{STATUS_LABEL[a.status] ?? a.status}</Chip>
                </View>
                {chore ? (
                  <Text variant="bodySmall">{chore.reward} {currencyName}</Text>
                ) : null}
                {due ? (
                  <Chip compact icon="clock-outline" style={[due.overdue ? styles.overdueChip : styles.dueChip, due.overdue ? { backgroundColor: theme.colors.errorContainer } : {}]}>
                    {due.label}
                  </Chip>
                ) : null}
                {a.status === "rejected" ? (
                  <>
                    {a.rejection_message ? (
                      <Text style={[styles.rejected, { color: theme.colors.error }]}>Parent said: {a.rejection_message}</Text>
                    ) : null}
                    {a.kid_response ? (
                      <Text style={[styles.kidSaid, { color: theme.colors.onSurfaceVariant }]}>You said: {a.kid_response}</Text>
                    ) : null}
                    <View style={styles.buttonRow}>
                      <Button mode="outlined" icon="reply" onPress={() => setReplyFor(a)}>
                        Reply
                      </Button>
                      <Button mode="contained" icon="camera" onPress={() => markDoneWithPhoto(a.id, true)}>
                        Redo with photo
                      </Button>
                    </View>
                  </>
                ) : null}
                {a.status === "assigned" ? (
                  <>
                    {chore?.photo_required ? (
                      <Button mode="contained" onPress={() => markDoneWithPhoto(a.id)} style={styles.doneBtn} icon="camera">
                        Take photo & mark done
                      </Button>
                    ) : (
                      <Button mode="contained" onPress={() => markDone(a.id)} style={styles.doneBtn}>
                        Mark done
                      </Button>
                    )}
                    <View style={styles.utilityRow}>
                      <IconButton icon="alarm" size={18} onPress={() => setRemindFor(a)} />
                      {siblings.length > 0 && !offered ? (
                        <IconButton icon="swap-horizontal" size={18} onPress={() => setSwapFor(a)} />
                      ) : null}
                      {offered ? <Text variant="bodySmall" style={styles.offeredNote}>Swap offered…</Text> : null}
                      {a.kid_reminder_at ? <Text variant="bodySmall" style={styles.offeredNote}>⏰ set</Text> : null}
                    </View>
                  </>
                ) : null}
              </Card.Content>
            </Card>
          );
        })}

        <Text variant="titleMedium" style={styles.heading}>
          My goals 🎯
        </Text>
        <GoalList
          goals={goals}
          balance={me.balance}
          currencyName={currencyName}
          onCreate={(name, target) => act(() => client.createGoal(user.id, name, target), "Goal added!")()}
          onDelete={(id) => act(() => client.deleteGoal(id))()}
        />

        {broadcasts.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.heading}>
              From parent 📣
            </Text>
            {broadcasts.map((b) => (
              <Card key={b.id} style={styles.choreCard}>
                <Card.Content>
                  <Text variant="bodyMedium">{b.message}</Text>
                  <Text variant="bodySmall" style={styles.date}>
                    {b.created.slice(0, 10)}
                  </Text>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        {history.length > 0 && (
          <List.Accordion
            title={`My history (${history.length}${history.length === 50 ? "+" : ""})`}
            expanded={historyOpen}
            onPress={() => setHistoryOpen((v) => !v)}
            style={styles.historyAccordion}
          >
            {history.map((a) => (
              <Card key={a.id} style={[styles.choreCard, styles.historyCard]}>
                <Card.Content>
                  <View style={styles.choreRow}>
                    <Text variant="bodyLarge">
                      {a.expand?.chore?.name ?? "Chore"}
                      {a.reaction ? `  ${a.reaction}` : ""}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.earned, { color: theme.colors.primary }]}>
                      +{a.expand?.chore?.reward ?? "?"} {currencyName}
                    </Text>
                  </View>
                  {a.approved_at ? (
                    <Text variant="bodySmall" style={styles.date}>
                      {a.approved_at.slice(0, 10)}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            ))}
          </List.Accordion>
        )}
      </ScrollView>

      <SpendDialog
        currencyName={currencyName}
        goodsRate={household?.goods_rate ?? 0}
        visible={spendOpen}
        onClose={() => setSpendOpen(false)}
        onSubmit={async (amount, description) => {
          try {
            await client.submitSpendRequest(user.id, amount, description);
            setSpendOpen(false);
            setSnack("Spend request sent to your parent!");
          } catch (e) {
            setSnack(String(e));
          }
        }}
      />

      <ProposeDialog
        currencyName={currencyName}
        visible={proposeOpen}
        onClose={() => setProposeOpen(false)}
        onSubmit={async (name, reward) => {
          try {
            await client.proposeChore(user.household, user.id, name, reward);
            setProposeOpen(false);
            setSnack("Idea sent — fingers crossed! 💡");
          } catch (e) {
            setSnack(String(e));
          }
        }}
      />

      <ReplyDialog
        assignment={replyFor}
        onClose={() => setReplyFor(null)}
        onSubmit={async (message) => {
          if (!replyFor) return;
          try {
            await client.respondToRejection(replyFor.id, message);
            setReplyFor(null);
            setSnack("Reply sent!");
            await reload();
          } catch (e) {
            setSnack(String(e));
          }
        }}
      />

      <RemindDialog
        assignment={remindFor}
        onClose={() => setRemindFor(null)}
        onPick={async (when) => {
          if (!remindFor) return;
          try {
            await client.setKidReminder(remindFor.id, when);
            setRemindFor(null);
            setSnack("Reminder set! ⏰");
            await reload();
          } catch (e) {
            setSnack(String(e));
          }
        }}
      />

      <SwapDialog
        assignment={swapFor}
        siblings={siblings}
        onClose={() => setSwapFor(null)}
        onPick={async (siblingId) => {
          if (!swapFor) return;
          try {
            await client.offerSwap(swapFor.id, siblingId);
            setSwapFor(null);
            setSnack("Swap offered! 🔄");
            await reload();
          } catch (e) {
            setSnack(String(e));
          }
        }}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={5000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

function GoalList({
  goals,
  balance,
  currencyName,
  onCreate,
  onDelete,
}: {
  goals: SavingsGoal[];
  balance: number;
  currencyName: string;
  onCreate: (name: string, target: number) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");

  return (
    <View style={styles.goalList}>
      {goals.map((g) => {
        const progress = g.achieved ? 1 : Math.min(balance / g.target, 1);
        return (
          <Card key={g.id} style={styles.choreCard}>
            <Card.Content>
              <View style={styles.choreRow}>
                <Text variant="titleSmall">
                  {g.achieved ? "🏆 " : ""}
                  {g.name}
                </Text>
                <View style={styles.goalRight}>
                  <Text variant="bodySmall">
                    {g.achieved ? "Done!" : `${balance}/${g.target} ${currencyName}`}
                  </Text>
                  <IconButton icon="close" size={14} onPress={() => onDelete(g.id)} />
                </View>
              </View>
              <ProgressBar progress={progress} style={styles.goalBar} />
            </Card.Content>
          </Card>
        );
      })}
      <View style={styles.goalForm}>
        <TextInput
          dense
          placeholder="New goal (e.g. LEGO set)"
          value={name}
          onChangeText={setName}
          style={styles.goalNameInput}
        />
        <TextInput
          dense
          placeholder="Cost"
          value={target}
          onChangeText={setTarget}
          keyboardType="number-pad"
          style={styles.goalTargetInput}
        />
        <Button
          compact
          mode="contained-tonal"
          disabled={!name.trim() || !(Number(target) > 0)}
          onPress={() => {
            onCreate(name.trim(), Number(target));
            setName("");
            setTarget("");
          }}
        >
          Add
        </Button>
      </View>
    </View>
  );
}

function SpendDialog({
  currencyName,
  goodsRate,
  visible,
  onClose,
  onSubmit,
}: {
  currencyName: string;
  goodsRate: number;
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number, description: string) => void;
}) {
  const [amount, setAmount] = useState("10");
  const [description, setDescription] = useState("");
  const dollars = goodsRate > 0 && Number(amount) > 0 ? (Number(amount) / goodsRate).toFixed(2) : null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose}>
        <Dialog.Title>Ask to spend</Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="What do you want?"
            value={description}
            onChangeText={setDescription}
            style={styles.dialogInput}
          />
          <TextInput
            label={currencyName}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          {dollars ? (
            <Text variant="bodySmall" style={styles.conversion}>
              ≈ ${dollars} in real money
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Cancel</Button>
          <Button
            mode="contained"
            disabled={!description.trim() || !Number(amount)}
            onPress={() => onSubmit(Number(amount), description.trim())}
          >
            Send
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function ProposeDialog({
  currencyName,
  visible,
  onClose,
  onSubmit,
}: {
  currencyName: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, reward: number) => void;
}) {
  const [name, setName] = useState("");
  const [reward, setReward] = useState("10");

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose}>
        <Dialog.Title>Suggest a chore 💡</Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="What will you do?"
            value={name}
            onChangeText={setName}
            style={styles.dialogInput}
          />
          <TextInput
            label={`Asking ${currencyName}`}
            value={reward}
            onChangeText={setReward}
            keyboardType="number-pad"
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Cancel</Button>
          <Button
            mode="contained"
            disabled={!name.trim() || !(Number(reward) > 0)}
            onPress={() => onSubmit(name.trim(), Number(reward))}
          >
            Send
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function ReplyDialog({
  assignment,
  onClose,
  onSubmit,
}: {
  assignment: Expanded | null;
  onClose: () => void;
  onSubmit: (message: string) => void;
}) {
  const [message, setMessage] = useState("");

  return (
    <Portal>
      <Dialog visible={!!assignment} onDismiss={onClose}>
        <Dialog.Title>Reply about {assignment?.expand?.chore?.name ?? "this chore"}</Dialog.Title>
        <Dialog.Content>
          {assignment?.rejection_message ? (
            <Text variant="bodySmall" style={styles.dialogContext}>
              Parent said: {assignment.rejection_message}
            </Text>
          ) : null}
          <TextInput
            label="Your reply"
            value={message}
            onChangeText={setMessage}
            multiline
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Cancel</Button>
          <Button
            mode="contained"
            disabled={!message.trim()}
            onPress={() => {
              onSubmit(message.trim());
              setMessage("");
            }}
          >
            Send
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function RemindDialog({
  assignment,
  onClose,
  onPick,
}: {
  assignment: Expanded | null;
  onClose: () => void;
  onPick: (when: Date) => void;
}) {
  const presets: Array<[string, () => Date]> = [
    ["In 1 hour", () => new Date(Date.now() + 3600e3)],
    ["In 3 hours", () => new Date(Date.now() + 3 * 3600e3)],
    [
      "Tomorrow morning",
      () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    ],
  ];

  return (
    <Portal>
      <Dialog visible={!!assignment} onDismiss={onClose}>
        <Dialog.Title>Remind me ⏰</Dialog.Title>
        <Dialog.Content>
          {presets.map(([label, make]) => (
            <Button key={label} style={styles.presetBtn} mode="outlined" onPress={() => onPick(make())}>
              {label}
            </Button>
          ))}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function SwapDialog({
  assignment,
  siblings,
  onClose,
  onPick,
}: {
  assignment: Expanded | null;
  siblings: User[];
  onClose: () => void;
  onPick: (siblingId: string) => void;
}) {
  return (
    <Portal>
      <Dialog visible={!!assignment} onDismiss={onClose}>
        <Dialog.Title>Offer to… 🔄</Dialog.Title>
        <Dialog.Content>
          {siblings.map((s) => (
            <Button key={s.id} style={styles.presetBtn} mode="outlined" onPress={() => onPick(s.id)}>
              {s.display_name}
            </Button>
          ))}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  balanceCard: { marginBottom: 8 },
  balance: { fontWeight: "700", marginVertical: 4 },
  todoLine: { marginBottom: 8, opacity: 0.7 },
  dollarValue: { opacity: 0.6, marginBottom: 2 },
  streakChip: { marginRight: 4 },
  heading: { marginTop: 8, marginBottom: 4 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  choreCard: {},
  historyCard: { opacity: 0.75 },
  historyAccordion: { marginTop: 8, paddingVertical: 0 },
  choreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  choreName: { flexShrink: 1 },
  rejected: { marginTop: 4 },
  kidSaid: { marginTop: 2, fontStyle: "italic" },
  earned: { fontWeight: "700" },
  date: { opacity: 0.5, marginTop: 2 },
  doneBtn: { marginTop: 8 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  utilityRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  offeredNote: { opacity: 0.6 },
  dueChip: { alignSelf: "flex-start", marginTop: 4 },
  overdueChip: { alignSelf: "flex-start", marginTop: 4 },
  goalList: { gap: 8 },
  goalRight: { flexDirection: "row", alignItems: "center" },
  goalBar: { marginTop: 6, height: 8, borderRadius: 4 },
  goalForm: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalNameInput: { flex: 1 },
  goalTargetInput: { width: 70 },
  dialogInput: { marginBottom: 8 },
  dialogContext: { marginBottom: 8, opacity: 0.7 },
  conversion: { marginTop: 6, opacity: 0.7 },
  presetBtn: { marginBottom: 8 },
});
