import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, RefreshControl } from "react-native";
import {
  Appbar,
  Text,
  Button,
  Surface,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Broadcast, Chore, User } from "@paydirt/shared";
import { client } from "../lib/client";
import { takePhotoAndComplete } from "../lib/completeWithPhoto";

type Expanded = Assignment & { expand?: { chore?: Chore } };

export function SimpleKidHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  const theme = useTheme();
  const [balance, setBalance] = useState(user.balance);
  const [assignments, setAssignments] = useState<Expanded[]>([]);
  const [currencyName, setCurrencyName] = useState("parentBucks");
  const [goodsRate, setGoodsRate] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState("");

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [bal, list, household, bcs] = await Promise.all([
        client.getBalance(user.id),
        client.listActiveAssignmentsForChild(user.id),
        client.getHousehold(user.household),
        client.getRecentBroadcasts(user.household, 3),
      ]);
      setBalance(bal);
      setAssignments(list as Expanded[]);
      setCurrencyName(household.currency_name?.trim() || "parentBucks");
      setGoodsRate(household.goods_rate ?? 0);
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

  // Realtime: re-fetch when this kid's assignments or balance change, so
  // approvals show up without pull-to-refresh. Best-effort — if the
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

  async function markDone(id: string) {
    try {
      await client.markComplete(id);
      setSnack("Woohoo! Waiting for Mom/Dad to check!");
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  }

  async function markDoneWithPhoto(id: string) {
    try {
      const result = await takePhotoAndComplete(id);
      if (result === "no-permission") {
        setSnack("Need camera permission for this chore!");
        return;
      }
      if (result === "cancelled") return;
      setSnack("Woohoo! Waiting for Mom/Dad to check!");
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  }

  const activeChores = assignments.filter((a) => a.status === "assigned");
  const waitingChores = assignments.filter((a) => a.status === "completed");
  const redoChores = assignments.filter((a) => a.status === "rejected");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header>
        <Appbar.Content title={`Hi ${user.display_name}! 👋`} />
        <Appbar.Action icon="logout" onPress={onLogout} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        <Surface style={styles.balanceSurface} elevation={2}>
          <Text style={styles.balanceEmoji}>{user.avatar || "💰"}</Text>
          <Text style={styles.balanceNumber}>{balance}</Text>
          {goodsRate > 0 ? (
            <Text style={styles.dollarValue}>${(balance / goodsRate).toFixed(2)}</Text>
          ) : null}
          <Text style={styles.balanceLabel}>{currencyName}</Text>
        </Surface>

        {activeChores.length === 0 && waitingChores.length === 0 && redoChores.length === 0 && (
          <Surface style={styles.emptyCard} elevation={1}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyText}>All done! Great job!</Text>
          </Surface>
        )}

        {activeChores.map((a) => (
          <Surface key={a.id} style={styles.choreCard} elevation={2}>
            <Text style={styles.choreEmoji}>⭐</Text>
            <Text style={styles.choreName}>{a.expand?.chore?.name ?? "Chore"}</Text>
            {a.expand?.chore ? (
              <Text style={styles.choreReward}>+{a.expand.chore.reward} 💰</Text>
            ) : null}
            <Button
              mode="contained"
              style={styles.doneButton}
              contentStyle={styles.doneButtonContent}
              labelStyle={styles.doneButtonLabel}
              icon={a.expand?.chore?.photo_required ? "camera" : undefined}
              onPress={() => a.expand?.chore?.photo_required ? markDoneWithPhoto(a.id) : markDone(a.id)}
            >
              {a.expand?.chore?.photo_required ? "Take photo! 📷" : "I did it! ✓"}
            </Button>
          </Surface>
        ))}

        {redoChores.map((a) => (
          <Surface key={a.id} style={[styles.choreCard, styles.redoCard, { backgroundColor: theme.colors.errorContainer }]} elevation={2}>
            <Text style={styles.choreEmoji}>😅</Text>
            <Text style={styles.choreName}>{a.expand?.chore?.name ?? "Chore"}</Text>
            {a.rejection_message ? (
              <Text style={styles.waitingText}>{a.rejection_message}</Text>
            ) : null}
            <Button
              mode="contained"
              style={styles.doneButton}
              contentStyle={styles.doneButtonContent}
              labelStyle={styles.doneButtonLabel}
              icon="camera"
              onPress={() => markDoneWithPhoto(a.id)}
            >
              Try again! 📷
            </Button>
          </Surface>
        ))}

        {waitingChores.map((a) => (
          <Surface key={a.id} style={[styles.choreCard, styles.waitingCard]} elevation={1}>
            <Text style={styles.choreEmoji}>⏳</Text>
            <Text style={styles.choreName}>{a.expand?.chore?.name ?? "Chore"}</Text>
            <Text style={styles.waitingText}>Waiting for Mom/Dad…</Text>
          </Surface>
        ))}

        {broadcasts.map((b) => (
          <Surface key={b.id} style={[styles.choreCard, styles.broadcastCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={1}>
            <Text style={styles.choreEmoji}>📣</Text>
            <Text style={styles.broadcastText}>{b.message}</Text>
          </Surface>
        ))}
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={5000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, alignItems: "center" },
  balanceSurface: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  balanceEmoji: { fontSize: 48 },
  balanceNumber: { fontSize: 72, fontWeight: "900", lineHeight: 80 },
  dollarValue: { fontSize: 28, fontWeight: "600", opacity: 0.65 },
  balanceLabel: { fontSize: 20, opacity: 0.7 },
  emptyCard: {
    width: "100%",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 24, fontWeight: "700", marginTop: 8, textAlign: "center" },
  choreCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  waitingCard: { opacity: 0.6 },
  redoCard: {},
  choreEmoji: { fontSize: 40 },
  choreName: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  choreReward: { fontSize: 22, fontWeight: "600" },
  doneButton: { marginTop: 8, width: "100%", borderRadius: 16 },
  doneButtonContent: { paddingVertical: 12 },
  doneButtonLabel: { fontSize: 22, fontWeight: "700" },
  waitingText: { fontSize: 18, opacity: 0.7, textAlign: "center" },
  broadcastCard: {},
  broadcastText: { fontSize: 22, fontWeight: "600", textAlign: "center" },
});
