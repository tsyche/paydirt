import { useEffect, useState } from "react";
import { errorMessage, householdDateTime } from "@paydirt/shared";
import { View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import type { KudosAward } from "@paydirt/shared";

import { client } from "../lib/client";
import { ArchiveRow, useArchives } from "./ArchiveActions";
import { ArchiveHistory } from "./ArchiveHistory";

/** A kid's private list of parent "Great work" awards. */
export function KudosHistory({
  awards,
  currencyName,
  simple = false,
}: {
  awards: KudosAward[];
  currencyName: string;
  simple?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(simple);
  const { version } = useArchives();
  const [archived, setArchived] = useState(false);
  const [hidden, setHidden] = useState<Set<string> | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void client.listArchivedIds("kudos").then((ids) => { if (active) { setHidden(new Set(ids)); setError(""); } })
      .catch((e) => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [version, retryKey]);
  if (awards.length === 0) return null;

  return (
    <Card style={{ borderRadius: simple ? 20 : 16 }}>
      <Card.Content style={{ gap: 8 }}>
        <Button
          mode="text"
          icon="star"
          onPress={() => setOpen((value) => !value)}
          contentStyle={simple ? { paddingVertical: 6 } : undefined}
          labelStyle={simple ? { fontSize: 20, fontWeight: "800" } : undefined}
        >
          Great work ×{awards.length}
        </Button>
        <Button icon="archive-outline" onPress={() => setArchived((value) => !value)}>{archived ? "Current awards" : "Archived awards"}</Button>
        {!!error && <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => setRetryKey((v) => v + 1)}>Retry</Button></>}
        {archived ? <ArchiveHistory kind="kudos" /> : open && hidden && awards.filter((award) => !hidden.has(award.id)).map((award) => (
          <ArchiveRow key={award.id} kind="kudos" id={award.id} label={award.reason || "Great work"}>
          <View
            key={award.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant={simple ? "bodyLarge" : "bodyMedium"}>
                {award.reason || "Great work!"}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {householdDateTime(award.created)}
              </Text>
            </View>
            <Text
              variant={simple ? "titleMedium" : "bodyMedium"}
              style={{ color: theme.colors.primary, fontWeight: "700" }}
            >
              +{award.bucks} {currencyName}
            </Text>
          </View></ArchiveRow>
        ))}
      </Card.Content>
    </Card>
  );
}
