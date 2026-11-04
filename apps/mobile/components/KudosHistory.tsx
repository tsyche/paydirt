import { useState } from "react";
import { localDateLabel } from "@paydirt/shared";
import { View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import type { KudosAward } from "@paydirt/shared";

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
        {open && awards.map((award) => (
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
                {localDateLabel(award.created)}
              </Text>
            </View>
            <Text
              variant={simple ? "titleMedium" : "bodyMedium"}
              style={{ color: theme.colors.primary, fontWeight: "700" }}
            >
              +{award.bucks} {currencyName}
            </Text>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}
