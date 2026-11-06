import { useCallback } from "react";
import { View } from "react-native";
import { Button, Card, Divider, Text } from "react-native-paper";
import { bankedTimeLabel, householdDateTime, type ScreenGrantHistoryRow } from "@paydirt/shared";
import { client } from "../lib/client";
import { useHistoryFeed } from "../lib/useHistoryFeed";

export function PastScreenGrants({ householdId, reloadKey }: { householdId: string; reloadKey: number }) {
  const fetchPage = useCallback((after: ScreenGrantHistoryRow | undefined, limit: number) =>
    client.listScreenGrantHistoryPage(householdId, after, limit), [householdId]);
  const history = useHistoryFeed(fetchPage, reloadKey);
  if (!history.items.length && !history.busy && !history.error) return null;
  return <View style={{ gap: 12 }}>
    <Divider style={{ marginTop: 16 }} />
    <Text variant="labelLarge">PAST SCREEN-TIME GRANTS</Text>
    {history.items.map((grant) => <Card key={`${grant.bonus ? "bonus" : "purchase"}:${grant.id}`}>
      <Card.Content style={{ gap: 4 }}>
        <Text variant="titleMedium">{grant.expand?.child?.display_name ?? "Child"} — {grant.description}</Text>
        <Text>{bankedTimeLabel(grant)}</Text>
        <Text variant="bodySmall">{householdDateTime(grant.updated)}</Text>
      </Card.Content>
    </Card>)}
    {history.error ? <Text accessibilityRole="alert">{history.error}</Text> : null}
    {history.error ? <Button disabled={history.busy} onPress={() => void history.reload()}>Retry history</Button> : null}
    {history.hasMore ? <Button mode="outlined" loading={history.busy} disabled={history.busy}
      onPress={() => void history.loadMore()}>Show more</Button> : null}
  </View>;
}
