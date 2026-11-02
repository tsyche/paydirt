import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Card, SegmentedButtons, Text, useTheme } from "react-native-paper";
import type { Chore, Household, User } from "@paydirt/shared";
import {
  addSummaries, costStrip, currencyDisplayName, errorMessage, pctChange, periodRange, periodWeeks, screenRate,
  splitSpend, summarizePeriod, toDollars, weeklyPotential,
} from "@paydirt/shared";
import type { PeriodKind, PeriodSummary, SpendSplit } from "@paydirt/shared";
import { client } from "../lib/client";

const usd = (n: number | null) => (n === null ? "–" : `$${n.toFixed(2)}`);

/** Parent-only: what the economy actually cost over a period, plus each kid's weekly potential. */
export function OverviewView({
  household,
  kids,
  chores,
  heldByChore,
}: {
  household: Household | null;
  kids: User[];
  chores: Chore[];
  heldByChore: Record<string, Set<string>>;
}) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [cur, setCur] = useState<Record<string, PeriodSummary> | null>(null);
  const [prev, setPrev] = useState<PeriodSummary | null>(null);
  const [split, setSplit] = useState<SpendSplit | null>(null);
  const [error, setError] = useState("");

  const currency = currencyDisplayName(household);
  const goodsRate = household?.goods_rate ?? 0;
  const sRate = screenRate(household);
  const kidIds = useMemo(() => kids.map((k) => k.id), [kids]);
  const range = periodRange(kind, new Date(), offset);

  useEffect(() => {
    if (kidIds.length === 0) return;
    let live = true;
    const load = async (off: number) => {
      const r = periodRange(kind, new Date(), off);
      const [txns, done, reqs] = await Promise.all([
        client.listTransactionsInRange(kidIds, r.start, r.end),
        client.listApprovedInRange(kidIds, r.start, r.end),
        client.listSpendRequestsInRange(kidIds, r.start, r.end),
      ]);
      return {
        split: splitSpend(txns, reqs),
        byKid: Object.fromEntries(
          kidIds.map((id) => [
            id,
            summarizePeriod(txns.filter((t) => t.user === id), done.filter((a) => a.child === id)),
          ]),
        ),
      };
    };
    setError("");
    void Promise.all([load(offset), load(offset - 1)])
      .then(([c, p]) => {
        if (!live) return;
        setCur(c.byKid);
        setSplit(c.split);
        setPrev(addSummaries(Object.values(p.byKid)));
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => { live = false; };
  }, [kidIds, kind, offset]);

  const total = cur ? addSummaries(Object.values(cur)) : null;
  const delta = total && prev ? pctChange(total.earned, prev.earned) : null;

  const weeklyBucks = kids.reduce(
    (n, k) => n + weeklyPotential(chores.filter((c) => heldByChore[c.id]?.has(k.id)), goodsRate, sRate).bucks,
    0,
  );
  const strip = total ? costStrip(total.earned, weeklyBucks, periodWeeks(range), goodsRate) : null;

  return (
    <View style={styles.wrap}>
      <SegmentedButtons
        value={kind}
        onValueChange={(v) => { setKind(v as PeriodKind); setOffset(0); }}
        buttons={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]}
      />
      <View style={styles.nav}>
        <Button compact onPress={() => setOffset((o) => o - 1)} accessibilityLabel="Previous period">◀</Button>
        <Text variant="titleSmall">{range.label}</Text>
        <Button compact onPress={() => setOffset((o) => o + 1)} disabled={offset >= 0} accessibilityLabel="Next period">▶</Button>
      </View>
      {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}

      {total && strip && (
        <Card>
          <Card.Content style={{ gap: 6 }}>
            <Text variant="bodyMedium" testID="cost-strip">
              Paid vs. potential: <Text style={styles.bold}>{strip.paid} / {strip.max} {currency}</Text>
              {strip.pct === null ? "" : ` (${strip.pct}%)`} · {usd(strip.paidDollars)} of {usd(strip.maxDollars)}
            </Text>
            <Text variant="bodyMedium">
              Screen time redeemed: <Text style={styles.bold}>{split?.screenBucks ?? 0} {currency}</Text> · {split?.screenMinutes ?? 0} min
            </Text>
            <Text variant="bodyMedium">
              Real money redeemed: <Text style={styles.bold}>{usd(toDollars(split?.goodsBucks ?? 0, goodsRate))}</Text> ({split?.goodsBucks ?? 0} {currency} on goods)
            </Text>
            <Text variant="bodyMedium">
              Earned by kids: <Text style={styles.bold}>{total.earned} {currency}</Text> ({usd(toDollars(total.earned, goodsRate))})
              {delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta}% vs last ${kind}` : ""}
            </Text>
            <Text variant="bodyMedium">
              Redeemed: <Text style={styles.bold}>{total.spent} {currency}</Text> ({usd(toDollars(total.spent, goodsRate))})
            </Text>
            <Text variant="bodyMedium">
              Bonus time from chores: <Text style={styles.bold}>{total.bonusMinutes} min</Text> · {total.chores} chores done
            </Text>
            <Text variant="bodyMedium">
              Parent adjustments: <Text style={styles.bold}>{total.adjustments >= 0 ? "+" : ""}{total.adjustments} {currency}</Text>
            </Text>
            {kids.map((k) => {
              const s = cur?.[k.id];
              return (
                <Text key={k.id} variant="bodySmall" style={muted}>
                  {k.display_name}: {s?.chores ?? 0} chores · {k.streak_count ?? 0}d streak · earned {s?.earned ?? 0} · redeemed {s?.spent ?? 0} · {s?.bonusMinutes ?? 0} bonus min
                </Text>
              );
            })}
          </Card.Content>
        </Card>
      )}

      <Text variant="titleSmall" style={{ fontWeight: "700", marginTop: 4 }}>Weekly potential per kid</Text>
      <Card>
        <Card.Content style={{ gap: 6 }}>
          {kids.map((k) => {
            const p = weeklyPotential(chores.filter((c) => heldByChore[c.id]?.has(k.id)), goodsRate, sRate);
            return (
              <Text key={k.id} variant="bodyMedium">
                <Text style={styles.bold}>{k.display_name}</Text>: {p.bucks} {currency}/wk
                {p.bonusMinutes ? ` + ${p.bonusMinutes} min` : ""} · {usd(p.dollars)} · ~{p.screenMinutes} screen min
                {"\n"}
                <Text variant="bodySmall" style={muted}>
                  {p.chores} recurring{p.oneOffs ? ` (+${p.oneOffs} one-off, not counted)` : ""}
                </Text>
              </Text>
            );
          })}
        </Card.Content>
      </Card>
      <Text variant="bodySmall" style={muted}>
        Dollars use today's rate ({goodsRate > 0 ? `${goodsRate} ${currency} = $1` : "no dollar rate set"}); past periods shift if it changes.
        Potential is a ceiling: limits are advisory and one-offs are not counted. Screen minutes use {sRate} {currency}/min.
      </Text>
    </View>
  );
}

/** Chart-icon Appbar action that opens the Overview full-screen. */
export function OverviewModalButton(props: {
  household: Household | null;
  kids: User[];
  chores: Chore[];
  heldByChore: Record<string, Set<string>>;
}) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  return (
    <>
      <Appbar.Action icon="chart-box-outline" accessibilityLabel="Overview" onPress={() => setOpen(true)} />
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <Appbar.Header>
            <Appbar.BackAction onPress={() => setOpen(false)} accessibilityLabel="Close overview" />
            <Appbar.Content title="📊 Overview" />
          </Appbar.Header>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <OverviewView {...props} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, padding: 12, paddingBottom: 0 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bold: { fontWeight: "700" },
});
