import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Card, Icon, ProgressBar, Text, useTheme } from "react-native-paper";
import { bankView, bankedTimeLabel, kidBankSummary, type Assignment, type Chore, type SavingsGoal, type SpendRequest, type TimeGrant } from "@paydirt/shared";

/** Private bank detail for both kid homes. Goals share the same balance. */
export function MyBank({ earnedTime, balance, currency, goodsRate, screenRate, streak, assignments, goals, requests, grants = [], simple = false }: {
  earnedTime?: ReactNode;
  balance: number; currency: string; goodsRate: number; screenRate: number; streak: number;
  assignments: (Assignment & { expand?: { chore?: Chore } })[];
  goals: SavingsGoal[]; requests: SpendRequest[]; simple?: boolean;
  grants?: TimeGrant[];
}) {
  const totals = kidBankSummary(balance, assignments, requests);
  const available = bankView(totals.available, goodsRate, screenRate);
  const { colors } = useTheme();
  const waitingTime = [
    ...requests.filter((request) => request.grant_status === "queued" || request.grant_status === "manual"),
    ...grants.filter((grant) => grant.grant_status === "queued" || grant.grant_status === "manual"),
  ];
  const body = simple ? "bodyLarge" : "bodyMedium";
  return (
    <Card mode="outlined" style={[styles.card, { borderColor: colors.outlineVariant }]}>
      <Card.Content style={styles.content}>
        <View style={styles.heading}>
          <View style={styles.title}>
            <Icon source="wallet-outline" size={26} color={colors.primary} />
            <Text variant={simple ? "headlineSmall" : "titleLarge"} accessibilityRole="header">My Bank</Text>
          </View>
          <View style={[styles.streak, { backgroundColor: colors.surfaceVariant }]}>
            <Icon source="fire" size={18} color={colors.primary} />
            <Text variant="labelMedium">{streak} day streak</Text>
          </View>
        </View>

        <View accessibilityLabel="Available balance" style={[styles.balance, { backgroundColor: colors.primaryContainer }]}>
          <Text variant="labelLarge" style={{ color: colors.onPrimaryContainer }}>Available to spend</Text>
          <View style={styles.amount}>
            <Text variant="displaySmall" style={{ color: colors.onPrimaryContainer }}>{totals.available}</Text>
            <Text variant="titleMedium" style={{ color: colors.onPrimaryContainer }}>{currency}</Text>
          </View>
          <View style={[styles.balanceDetails, { borderTopColor: colors.onPrimaryContainer }]}>
            <View style={styles.stat}>
              <Text variant="labelMedium" style={{ color: colors.onPrimaryContainer }}>In your bank</Text>
              <Text variant={body} style={{ color: colors.onPrimaryContainer }}>{balance} {currency}</Text>
            </View>
            <View style={styles.stat}>
              <Text variant="labelMedium" style={{ color: colors.onPrimaryContainer }}>Pending spending</Text>
              <Text variant={body} style={{ color: colors.onPrimaryContainer }}>{totals.pendingSpend} {currency}</Text>
            </View>
          </View>
        </View>

        {earnedTime}

        <View accessibilityLabel="Reward options" style={styles.section}>
          <Text variant="titleMedium" accessibilityRole="header">What you could get</Text>
          <View style={styles.tiles}>
            {available.dollars !== null && <View style={[styles.tile, { backgroundColor: colors.surfaceVariant }]}>
              <Icon source="cash-multiple" size={24} color={colors.primary} />
              <Text variant="headlineSmall">${available.dollars.toFixed(2)}</Text>
              <Text variant={body}>Money value</Text>
            </View>}
            <View style={[styles.tile, { backgroundColor: colors.surfaceVariant }]}>
              <Icon source="timer-outline" size={24} color={colors.primary} />
              <Text variant="headlineSmall">{available.screenMinutes} min</Text>
              <Text variant={body}>Screen time</Text>
            </View>
          </View>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {available.dollars === null ? "Screen-time requests need parent approval." : "Two ways to use the same balance. Requests need parent approval."}
          </Text>
        </View>

        <View accessibilityLabel="Pending chore earnings" style={[styles.pending, { borderColor: colors.outlineVariant }]}>
          <Icon source="clock-outline" size={24} color={colors.primary} />
          <View style={styles.flex}>
            <Text variant="titleSmall">Waiting for approval</Text>
            <Text variant={body}>{totals.pendingEarn} {currency} from chores</Text>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>An estimate, not in your balance yet.</Text>
          </View>
        </View>

        {waitingTime.length > 0 && <View accessibilityLabel="Queued screen time" style={styles.section}>
          <Text variant="titleMedium" accessibilityRole="header">Time awaiting delivery</Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            Already earned or purchased. Separate from your {currency}.
          </Text>
          {waitingTime.map((grant) => (
            <View key={grant.id} style={[styles.timeRow, { backgroundColor: colors.secondaryContainer }]}>
              <Icon source={grant.grant_status === "manual" ? "account-question-outline" : "timer-sand"} size={24} color={colors.onSecondaryContainer} />
              <View style={styles.flex}>
                {!!grant.description && <Text variant="titleSmall" style={{ color: colors.onSecondaryContainer }}>{grant.description}</Text>}
                <Text variant={body} style={{ color: colors.onSecondaryContainer }}>{bankedTimeLabel(grant)}</Text>
                {!!grant.grant_error && <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>{grant.grant_error}</Text>}
              </View>
            </View>
          ))}
        </View>}

        <View accessibilityLabel="Savings goals" style={styles.section}>
          <Text variant="titleMedium" accessibilityRole="header">Saving for</Text>
          {goals.filter((goal) => !goal.achieved).map((goal) => {
            const progress = Math.min(1, Math.max(0, balance / goal.target));
            return <View key={goal.id} style={[styles.goal, { borderColor: colors.outlineVariant }]}>
              <Text variant="titleSmall">{goal.name}</Text>
              <Text variant={body}>{Math.min(balance, goal.target)} / {goal.target} {currency}</Text>
              <ProgressBar progress={progress} style={styles.progress} accessibilityLabel={`${goal.name} progress`} />
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{Math.max(0, goal.target - balance)} to go</Text>
            </View>;
          })}
          {goals.filter((goal) => goal.achieved).map((goal) => (
            <View key={goal.id} style={styles.title}>
              <Icon source="check-circle-outline" size={20} color={colors.primary} />
              <Text variant={body}>{goal.name} — goal reached!</Text>
            </View>
          ))}
          {goals.length > 0
            ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Goals share your bank balance; money is not set aside separately.</Text>
            : <Text variant={body} style={{ color: colors.onSurfaceVariant }}>No savings goal yet.</Text>}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24 },
  content: { padding: 20, gap: 24 },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  streak: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 20 },
  balance: { padding: 20, borderRadius: 20, gap: 8 },
  amount: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  balanceDetails: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingTop: 16, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  stat: { flexGrow: 1, flexBasis: 110, gap: 4 },
  section: { gap: 12 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: 130, borderRadius: 16, padding: 16, gap: 8 },
  pending: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderRadius: 16, padding: 16 },
  flex: { flex: 1, gap: 6 },
  timeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 16 },
  goal: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  progress: { height: 8, borderRadius: 4, marginVertical: 4 },
});
