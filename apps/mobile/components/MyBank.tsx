import { View } from "react-native";
import { Card, ProgressBar, Text } from "react-native-paper";
import { bankView, kidBankSummary, type Assignment, type Chore, type SavingsGoal, type SpendRequest, type TimeGrant } from "@paydirt/shared";

/** Private bank detail for both kid homes. Goals share the same balance. */
export function MyBank({ balance, currency, goodsRate, screenRate, streak, assignments, goals, requests, grants = [], simple = false }: {
  balance: number; currency: string; goodsRate: number; screenRate: number; streak: number;
  assignments: (Assignment & { expand?: { chore?: Chore } })[];
  goals: SavingsGoal[]; requests: SpendRequest[]; simple?: boolean;
  grants?: TimeGrant[];
}) {
  const totals = kidBankSummary(balance, assignments, requests);
  const available = bankView(totals.available, goodsRate, screenRate);
  return <Card>
    <Card.Content style={{ gap: 10 }}>
      <Text variant={simple ? "headlineMedium" : "titleLarge"}>💰 My Bank</Text>
      <Text variant="titleMedium">{totals.available} {currency} available</Text>
      <Text>{balance} in your bank · {totals.pendingSpend} waiting to spend</Text>
      <Text>{available.dollars === null ? "" : `$${available.dollars.toFixed(2)} or `}{available.screenMinutes} min you could buy</Text>
      <Text>⏳ {totals.pendingEarn} {currency} awaiting chore approval (estimate)</Text>
      <Text>🔥 {streak} day streak</Text>
      {requests.filter((request) => request.grant_status === "queued").map((request) => (
        <Text key={request.id}>📱 {request.screen_minutes} min: {request.grant_error || "Queued for delivery"}</Text>
      ))}
      {grants.map((grant) => <Text key={grant.id}>📱 {grant.minutes} bonus min: {grant.grant_error || "Queued for delivery"}</Text>)}
      {goals.filter((goal) => !goal.achieved).map((goal) => {
        const progress = Math.min(1, Math.max(0, balance / goal.target));
        return <View key={goal.id} style={{ gap: 4 }}>
          <Text>{goal.name}: {Math.min(balance, goal.target)} / {goal.target} {currency}</Text>
          <ProgressBar progress={progress} />
          <Text>{Math.max(0, goal.target - balance)} to go</Text>
        </View>;
      })}
      {goals.some((goal) => !goal.achieved) && <Text>Goals use the same bank balance; money is not set aside separately.</Text>}
      {goals.length === 0 && <Text>No savings goal yet.</Text>}
    </Card.Content>
  </Card>;
}
