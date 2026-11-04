import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import type { MonthActivity, User } from "@paydirt/shared";
import { summarizeMonthActivity, householdWallDate } from "@paydirt/shared";
import { client } from "../lib/client";

/** Monthly per-kid activity summary (chores, earned, spent, streak peak). Mirrors the web report. */
export function ActivityReport({ kids, currencyName }: { kids: User[]; currencyName: string }) {
  const now = householdWallDate();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<({ kid: User } & MonthActivity)[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || kids.length === 0) return;
    setLoading(true);
    void Promise.all(
      kids.map(async (kid) => {
        const [txns, assignments] = await Promise.all([
          client.listTransactionsForMonth(kid.id, year, month),
          client.listApprovedAssignmentsForMonth(kid.id, year, month),
        ]);
        return { kid, ...summarizeMonthActivity(txns, assignments) };
      }),
    )
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, kids, year, month]);

  const atCurrent = year === now.getFullYear() && month === now.getMonth() + 1;

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <View style={styles.wrap}>
      <Button mode="outlined" icon="chart-box-outline" onPress={() => setOpen((v) => !v)}>
        {open ? "Hide" : "Show"} activity report
      </Button>
      {open && (
        <View style={styles.body}>
          <View style={styles.row}>
            <Button compact onPress={() => shift(-1)} accessibilityLabel="Previous month">◀</Button>
            <Text variant="titleSmall">
              {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <Button compact disabled={atCurrent} onPress={() => shift(1)} accessibilityLabel="Next month">▶</Button>
          </View>
          {loading && <Text>Loading…</Text>}
          {!loading && data.map(({ kid, chores, earned, spent, peak }) => (
            <Card key={kid.id} style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall">{kid.avatar_emoji ? `${kid.avatar_emoji} ` : ""}{kid.display_name}</Text>
                <Text>✅ Chores: {chores}</Text>
                <Text>💰 Earned: {earned} {currencyName}</Text>
                <Text>🛍️ Spent: {spent} {currencyName}</Text>
                <Text>🔥 Streak peak: {peak} day{peak !== 1 ? "s" : ""}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  body: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: { marginBottom: 4 },
});
