import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import {
  Appbar,
  Card,
  Text,
  Button,
  Chip,
  Portal,
  Dialog,
  TextInput,
  Snackbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { Assignment, Chore, User } from "@paydirt/shared";
import { client } from "../lib/client";

type Expanded = Assignment & { expand?: { chore?: Chore } };

const STATUS_LABEL: Record<Assignment["status"], string> = {
  assigned: "To do",
  completed: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
};

export function KidHome({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [balance, setBalance] = useState(user.balance);
  const [assignments, setAssignments] = useState<Expanded[]>([]);
  const [currencyName, setCurrencyName] = useState("parentBucks");
  const [refreshing, setRefreshing] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [snack, setSnack] = useState("");

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [bal, list, household] = await Promise.all([
        client.getBalance(user.id),
        client.listAssignmentsForChild(user.id),
        client.getHousehold(user.household),
      ]);
      setBalance(bal);
      setAssignments(list as Expanded[]);
      setCurrencyName(household.currency_name?.trim() || "parentBucks");
    } catch (e) {
      setSnack(String(e));
    } finally {
      setRefreshing(false);
    }
  }, [user.id, user.household]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function markDone(id: string) {
    try {
      await client.markComplete(id);
      setSnack("Marked done — waiting for approval!");
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  }

  async function markDoneWithPhoto(id: string) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      setSnack("Camera permission needed to submit this chore.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.7,
    });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("status", "completed");
      formData.append("completed_at", new Date().toISOString());
      formData.append("photo", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: "proof.jpg",
      } as unknown as Blob);
      await client.pb.collection("assignments").update(id, formData);
      setSnack("Marked done — waiting for approval!");
      await reload();
    } catch (e) {
      setSnack(String(e));
    }
  }

  const activeAssignments = assignments.filter((a) => a.status !== "approved");
  const history = assignments
    .filter((a) => a.status === "approved")
    .slice(0, 10);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header>
        <Appbar.Content title={`Hi, ${user.display_name}`} />
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
              {balance}
            </Text>
            <Button mode="contained-tonal" onPress={() => setSpendOpen(true)}>
              Ask to spend
            </Button>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.heading}>
          My chores
        </Text>
        {activeAssignments.length === 0 && <Text>No chores right now. 🎉</Text>}
        {activeAssignments.map((a) => (
          <Card key={a.id} style={styles.choreCard}>
            <Card.Content>
              <View style={styles.choreRow}>
                <Text variant="titleMedium">{a.expand?.chore?.name ?? "Chore"}</Text>
                <Chip compact>{STATUS_LABEL[a.status]}</Chip>
              </View>
              {a.expand?.chore ? (
                <Text variant="bodySmall">{a.expand.chore.reward} {currencyName}</Text>
              ) : null}
              {a.status === "rejected" && a.rejection_message ? (
                <Text style={styles.rejected}>{a.rejection_message}</Text>
              ) : null}
              {a.status === "assigned" ? (
                a.expand?.chore?.photo_required ? (
                  <Button mode="contained" onPress={() => markDoneWithPhoto(a.id)} style={styles.doneBtn} icon="camera">
                    Take photo & mark done
                  </Button>
                ) : (
                  <Button mode="contained" onPress={() => markDone(a.id)} style={styles.doneBtn}>
                    Mark done
                  </Button>
                )
              ) : null}
            </Card.Content>
          </Card>
        ))}

        {history.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.heading}>
              My history
            </Text>
            {history.map((a) => (
              <Card key={a.id} style={[styles.choreCard, styles.historyCard]}>
                <Card.Content>
                  <View style={styles.choreRow}>
                    <Text variant="bodyLarge">{a.expand?.chore?.name ?? "Chore"}</Text>
                    <Text variant="bodyMedium" style={styles.earned}>
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
          </>
        )}
      </ScrollView>

      <SpendDialog
        currencyName={currencyName}
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

      <Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={3000}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

function SpendDialog({
  currencyName,
  visible,
  onClose,
  onSubmit,
}: {
  currencyName: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number, description: string) => void;
}) {
  const [amount, setAmount] = useState("10");
  const [description, setDescription] = useState("");

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  balanceCard: { marginBottom: 8 },
  balance: { fontWeight: "700", marginVertical: 4 },
  heading: { marginTop: 8, marginBottom: 4 },
  choreCard: {},
  historyCard: { opacity: 0.75 },
  choreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rejected: { color: "#b3433a", marginTop: 4 },
  earned: { color: "#2f7d4f", fontWeight: "700" },
  date: { opacity: 0.5, marginTop: 2 },
  doneBtn: { marginTop: 8 },
  dialogInput: { marginBottom: 8 },
});
