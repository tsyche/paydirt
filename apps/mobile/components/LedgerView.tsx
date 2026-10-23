import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Text } from "react-native-paper";
import type { CurrencyTransaction, Household, User } from "@paydirt/shared";
import { currencyDisplayName } from "@paydirt/shared";
import { client } from "../lib/client";

export function LedgerView({ household }: { household: Household | null }) {
  const [kids, setKids] = useState<User[]>([]);
  const [kidId, setKidId] = useState<string>("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [txns, setTxns] = useState<CurrencyTransaction[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!household) return;
    void client.listChildren(household.id).then((k) => {
      setKids(k);
      if (k.length && !kidId) setKidId(k[0].id);
    });
  }, [household]);

  useEffect(() => {
    if (!kidId) return;
    setBusy(true);
    void client
      .listTransactionsForMonth(kidId, year, month)
      .then(setTxns)
      .finally(() => setBusy(false));
  }, [kidId, year, month]);

  const currency = currencyDisplayName(household);
  const total = txns.reduce((s, t) => s + t.amount, 0);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ScrollView horizontal style={{ marginBottom: 8 }}>
        {kids.map((k) => (
          <Chip
            key={k.id}
            selected={k.id === kidId}
            onPress={() => setKidId(k.id)}
            style={{ marginRight: 4 }}
          >
            {k.display_name}
          </Chip>
        ))}
      </ScrollView>
      <View style={styles.row}>
        <Button compact onPress={() => shift(-1)}>◀</Button>
        <Text variant="titleSmall">
          {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </Text>
        <Button compact onPress={() => shift(1)}>▶</Button>
      </View>
      {busy && <Text>Loading…</Text>}
      {txns.map((t) => (
        <Card key={t.id} style={styles.card}>
          <Card.Content style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text variant="bodySmall" style={{ color: "#888" }}>{t.created.slice(0, 10)}</Text>
              <Text variant="bodyMedium">{t.reason}</Text>
            </View>
            <Text variant="titleSmall" style={{ color: t.amount >= 0 ? "green" : "red" }}>
              {t.amount >= 0 ? "+" : ""}{t.amount} {currency}
            </Text>
          </Card.Content>
        </Card>
      ))}
      {txns.length === 0 && !busy && <Text>No transactions this month.</Text>}
      <Text variant="titleSmall" style={{ marginTop: 8 }}>
        Month net: {total >= 0 ? "+" : ""}{total} {currency}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  card: { marginBottom: 6 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
