import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Card, IconButton, Text, useTheme } from "react-native-paper";
import { TextInput } from "./TextInput";
import { AVATAR_COLORS, errorMessage, featureTip, kidAccent, parseGoodsRateOverride } from "@paydirt/shared";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";

/** Parent edits a kid's emoji, photo, accent colour, and bucks-per-dollar override. */
export function KidAppearanceCard({
  kid,
  onSaved,
  onMessage,
}: {
  kid: User;
  onSaved: () => void;
  onMessage: (msg: string) => void;
}) {
  const theme = useTheme();
  const [emoji, setEmoji] = useState(kid.avatar_emoji ?? "");
  const [color, setColor] = useState(kidAccent(kid.color, AVATAR_COLORS[0]));
  const [rate, setRate] = useState(kid.goods_rate ? String(kid.goods_rate) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await client.pb.collection("users").update(kid.id, {
        avatar_emoji: emoji.trim(),
        color,
        goods_rate: parseGoodsRateOverride(rate),
      });
      onMessage("Saved");
      onSaved();
    } catch (e) {
      onMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleSmall">Avatar &amp; rate</Text>
        <TextInput dense label="Emoji (e.g. 🦊) — tap the picture above to use a photo" value={emoji} onChangeText={setEmoji} style={styles.field} />
        <View style={styles.swatches}>
          {AVATAR_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: c, borderColor: color === c ? theme.colors.onSurface : "transparent" },
              ]}
            />
          ))}
        </View>
        <View style={styles.rateRow}>
          <TextInput
            dense
            label="Goods rate (per $1)"
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            style={styles.rateInput}
          />
          <IconButton
            icon="information-outline"
            size={16}
            onPress={() => onMessage(featureTip("goods_rate_kid") ?? "")}
          />
        </View>
        <View style={styles.actions}>
          <Button mode="contained-tonal" onPress={() => void save()} disabled={busy}>
            Save
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16 },
  field: { marginTop: 8 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  rateRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  rateInput: { flex: 1 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
