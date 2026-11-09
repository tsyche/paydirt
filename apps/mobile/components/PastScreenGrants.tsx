import { ArchiveRow, useArchives } from "./ArchiveActions";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Button, Card, Divider, Text } from "react-native-paper";
import { bankedTimeLabel, householdDateTime, type ScreenGrantHistoryRow } from "@paydirt/shared";
import { client } from "../lib/client";
import { useHistoryFeed } from "../lib/useHistoryFeed";

export function PastScreenGrants({ householdId, reloadKey }: { householdId: string; reloadKey: number }) {
  const [expanded, setExpanded] = useState(false);
  const fetchPage = useCallback((after: ScreenGrantHistoryRow | undefined, limit: number) =>
    client.listScreenGrantHistoryPage(householdId, after, limit), [householdId]);
  const { version } = useArchives();
  const history = useHistoryFeed(fetchPage, reloadKey + version);
  if (!history.items.length && !history.busy && !history.error) return null;
  return <View style={{ gap: 12 }}>
    <Divider style={{ marginTop: 16 }} />
    <Button accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} icon={expanded ? "chevron-up" : "chevron-down"}>Past screen-time grants</Button>
    {expanded && <>
    {history.items.map((grant) => <ArchiveRow key={`${grant.bonus ? "bonus" : "purchase"}:${grant.id}`} kind={grant.bonus ? "time_grant" : "spend_request"} id={grant.id} label={grant.description || "time grant"} onChanged={() => void history.reload()}><Card>
      <Card.Content style={{ gap: 4 }}>
        <Text variant="titleMedium">{grant.expand?.child?.display_name ?? "Child"} — {grant.description}</Text>
        <Text>{bankedTimeLabel(grant)}</Text>
        <Text variant="bodySmall">{householdDateTime(grant.updated)}</Text>
      </Card.Content>
    </Card></ArchiveRow>)}
    {history.error ? <Text accessibilityRole="alert">{history.error}</Text> : null}
    {history.error ? <Button disabled={history.busy} onPress={() => void history.reload()}>Retry history</Button> : null}
    {history.hasMore ? <Button mode="outlined" loading={history.busy} disabled={history.busy}
      onPress={() => void history.loadMore()}>Show more</Button> : null}
    </>}
  </View>;
}
