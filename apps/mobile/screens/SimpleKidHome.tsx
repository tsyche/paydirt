import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
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
  const [me, setMe] = useState<User>(user);
  const [balance, setBalance] = useState(user.balance);
  const [assignments, setAssignments] = useState<Expanded[]>([]);
  const [currencyName, setCurrencyName] = useState("parentBucks");
  const [householdRate, setHouseholdRate] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState("");

  const goodsRate = me.goods_rate ?? householdRate;

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [freshMe, bal, list, household, bcs] = await Promise.all([
        client.pb.collection("users").getOne<User>(user.id),
        client.getBalance(user.id),
        client.listActiveAssignmentsForChild(user.id),
        client.getHousehold(user.household),
        client.getRecentBroadcasts(user.household, 3),
      ]);
      setMe(freshMe);
      setBalance(bal);
      setAssignments(list as Expanded[]);
      setCurrencyName(household.currency_name?.trim() || "parentBucks");
      setHouseholdRate(household.goods_rate ?? 0);
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

  const accentColor = user.color ?? theme.colors.primary;

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
        {/* Balance hero card */}
        <Surface style={styles.balanceSurface} elevation={3}>
          <View style={[styles.avatarBand, { backgroundColor: accentColor }]}>
            <Text style={styles.balanceEmoji}>{user.avatar_emoji || "💰"}</Text>
          </View>
          <View style={styles.balanceBody}>
            <Text style={[styles.balanceNumber, { color: theme.colors.onSurface }]}>
              {balance}
            </Text>
            {goodsRate > 0 ? (
              <Text style={[styles.dollarValue, { color: theme.colors.onSurfaceVariant }]}>
                ${(balance / goodsRate).toFixed(2)}
              </Text>
            ) : null}
            <Text style={[styles.balanceLabel, { color: theme.colors.onSurfaceVariant }]}>
              {currencyName}
            </Text>
          </View>
        </Surface>

        {activeChores.length === 0 && waitingChores.length === 0 && redoChores.length === 0 && (
          <Surface style={styles.emptyCard} elevation={1}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
              All done! Great job!
            </Text>
          </Surface>
        )}

        {activeChores.map((a) => (
          <Surface key={a.id} style={styles.choreCard} elevation={2}>
            <Text style={styles.choreEmoji}>⭐</Text>
            <Text style={[styles.choreName, { color: theme.colors.onSurface }]}>
              {a.expand?.chore?.name ?? "Chore"}
            </Text>
            {a.expand?.chore ? (
              <Text style={[styles.choreReward, { color: accentColor }]}>
                +{a.expand.chore.reward} {user.avatar_emoji || "💰"}
              </Text>
            ) : null}
            <Button
              mode="contained"
              style={styles.doneButton}
              contentStyle={styles.doneButtonContent}
              labelStyle={styles.doneButtonLabel}
              icon={a.expand?.chore?.photo_required ? "camera" : "check-circle"}
              onPress={() =>
                a.expand?.chore?.photo_required ? markDoneWithPhoto(a.id) : markDone(a.id)
              }
            >
              {a.expand?.chore?.photo_required ? "Take photo! 📷" : "I did it! ✓"}
            </Button>
          </Surface>
        ))}

        {redoChores.map((a) => (
          <Surface
            key={a.id}
            style={[styles.choreCard, { backgroundColor: theme.colors.errorContainer }]}
            elevation={2}
          >
            <Text style={styles.choreEmoji}>😅</Text>
            <Text style={[styles.choreName, { color: theme.colors.onErrorContainer }]}>
              {a.expand?.chore?.name ?? "Chore"}
            </Text>
            {a.rejection_message ? (
              <Text style={[styles.waitingText, { color: theme.colors.onErrorContainer }]}>
                {a.rejection_message}
              </Text>
            ) : null}
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
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
            <Text style={[styles.choreName, { color: theme.colors.onSurface }]}>
              {a.expand?.chore?.name ?? "Chore"}
            </Text>
            <Text style={[styles.waitingText, { color: theme.colors.onSurfaceVariant }]}>
              Waiting for Mom/Dad…
            </Text>
          </Surface>
        ))}

        {broadcasts.map((b) => (
          <Surface
            key={b.id}
            style={[styles.choreCard, { backgroundColor: theme.colors.secondaryContainer }]}
            elevation={1}
          >
            <Text style={styles.choreEmoji}>📣</Text>
            <Text style={[styles.broadcastText, { color: theme.colors.onSecondaryContainer }]}>
              {b.message}
            </Text>
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
  content: { padding: 16, gap: 14, alignItems: "center" },

  balanceSurface: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
  },
  avatarBand: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 14,
  },
  balanceEmoji: { fontSize: 56 },
  balanceBody: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 2,
  },
  balanceNumber: { fontSize: 80, fontWeight: "900", lineHeight: 88 },
  dollarValue: { fontSize: 26, fontWeight: "600", opacity: 0.7 },
  balanceLabel: { fontSize: 18, opacity: 0.65, marginTop: 2 },

  emptyCard: {
    width: "100%",
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    gap: 10,
  },
  emptyEmoji: { fontSize: 64 },
  emptyText: { fontSize: 24, fontWeight: "800", textAlign: "center" },

  choreCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  waitingCard: { opacity: 0.6 },
  choreEmoji: { fontSize: 44 },
  choreName: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  choreReward: { fontSize: 20, fontWeight: "700" },
  doneButton: { marginTop: 4, width: "100%", borderRadius: 16 },
  doneButtonContent: { paddingVertical: 14 },
  doneButtonLabel: { fontSize: 20, fontWeight: "800" },
  waitingText: { fontSize: 17, textAlign: "center" },
  broadcastText: { fontSize: 20, fontWeight: "600", textAlign: "center" },
});
