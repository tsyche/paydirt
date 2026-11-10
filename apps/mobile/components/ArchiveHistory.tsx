import { ConversationButton, ConversationLink } from "./ChoreConversation";
import { useCallback } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { archiveDetails, archiveLabel, householdDateTime, type ArchivedItem, type ArchiveKind } from "@paydirt/shared";
import { client } from "../lib/client";
import { useHistoryFeed } from "../lib/useHistoryFeed";
import { useArchives } from "./ArchiveActions";

export function ArchiveHistory({ kind }: { kind?: ArchiveKind }) {
  const { version, restore, working } = useArchives();
  const fetchPage = useCallback((after: ArchivedItem | undefined, limit: number) => client.listArchivesPage(after, limit, kind), [kind]);
  const history = useHistoryFeed(fetchPage, version);
  return <View style={{ gap: 12, padding: 16 }}>
    <Text variant="titleMedium">Archived</Text>
    <Text variant="bodySmall">Personal history. Restoring an item does not award it again.</Text>
    {!history.busy && !history.items.length && !history.error && <Text>No archived items.</Text>}
    {history.items.map((item) => <View key={item.id} style={{ gap: 4, paddingVertical: 8 }}>
      <Text variant="titleSmall">{archiveLabel(item)}</Text>
      {!!archiveDetails(item) && <Text>{archiveDetails(item)}</Text>}
      <Text variant="bodySmall">Archived {householdDateTime(item.created)}</Text>
      {item.assignment && <ConversationButton assignmentId={item.assignment} />}
      <ConversationLink source={item.expand?.inbox?.source} />
      <Button icon="restore" disabled={working} onPress={() => void restore(item.id)}>Restore</Button>
    </View>)}
    {history.error && <><Text accessibilityRole="alert">{history.error}</Text><Button onPress={() => void history.reload()}>Retry</Button></>}
    {history.hasMore && <Button disabled={history.busy} onPress={() => void history.loadMore()}>Show more</Button>}
  </View>;
}
