import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Card, IconButton, Text, TextInput, useTheme } from "react-native-paper";
import { AVATAR_COLORS, errorMessage, featureTip, parseGoodsRateOverride } from "@paydirt/shared";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";
import { pickAndUploadAvatar } from "../lib/uploadAvatar";

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
  const [color, setColor] = useState(kid.color ?? AVATAR_COLORS[0]);
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

  async function choosePhoto() {
    setBusy(true);
    try {
      const res = await pickAndUploadAvatar(kid.id);
      if (res === "no-permission") onMessage("Allow photo access to pick an avatar.");
      else if (res === "done") {
        onMessage("Photo updated");
        onSaved();
      }
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
        <TextInput dense label="Emoji (e.g. 🦊)" value={emoji} onChangeText={setEmoji} style={styles.field} />
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
          <Button mode="outlined" icon="image" onPress={() => void choosePhoto()} disabled={busy}>
            Photo
          </Button>
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
  swatches: { flexDirection: "row", gap: 10, marginTop: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  rateRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  rateInput: { flex: 1 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
