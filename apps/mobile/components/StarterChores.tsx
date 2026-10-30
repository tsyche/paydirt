import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Checkbox, Text, useTheme } from "react-native-paper";
import {
  STARTER_BANDS,
  addableStarterChores,
  errorMessage,
  starterChoreInput,
} from "@paydirt/shared";
import { client } from "../lib/client";

/** Pick-and-add starter chores by age band. Chores already in the household (by name) are skipped. */
export function StarterChores({
  householdId,
  parentId,
  existingNames,
  onAdded,
  onMessage,
}: {
  householdId: string;
  parentId: string;
  existingNames: string[];
  onAdded: () => void;
  onMessage: (msg: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [bandId, setBandId] = useState(STARTER_BANDS[0].id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const band = STARTER_BANDS.find((b) => b.id === bandId) ?? STARTER_BANDS[0];
  const addable = addableStarterChores(band, existingNames);
  const key = (name: string) => `${band.id}/${name}`;
  const chosen = addable.filter((c) => picked.has(key(c.name)));

  function toggle(name: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key(name))) next.add(key(name));
      return next;
    });
  }

  function pickAll() {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const c of addable) next.add(key(c.name));
      return next;
    });
  }

  async function add() {
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      for (const c of chosen) await client.createChore(starterChoreInput(c, householdId, parentId));
      setPicked(new Set());
      onMessage(`Added ${chosen.length} chore${chosen.length === 1 ? "" : "s"} 🌱`);
    } catch (e) {
      onMessage(errorMessage(e));
    } finally {
      setBusy(false);
      onAdded(); // some may have been created before a failure
    }
  }

  return (
    <View>
      <Button
        mode="outlined"
        compact
        icon="sprout-outline"
        onPress={() => setOpen((o) => !o)}
        style={styles.toggle}
      >
        Starter chores {open ? "▲" : "▼"}
      </Button>
      {open && (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.bands}>
              {STARTER_BANDS.map((b) => (
                <Button
                  key={b.id}
                  compact
                  mode={b.id === bandId ? "contained-tonal" : "outlined"}
                  onPress={() => setBandId(b.id)}
                >
                  {b.label}
                </Button>
              ))}
            </View>
            {band.chores.map((c) => {
              const exists = have.has(c.name.toLowerCase());
              return (
                <View key={c.name} style={[styles.row, { opacity: exists ? 0.5 : 1 }]}>
                  <Checkbox
                    status={exists || picked.has(key(c.name)) ? "checked" : "unchecked"}
                    disabled={exists || busy}
                    onPress={() => toggle(c.name)}
                  />
                  <View style={styles.flex}>
                    <Text variant="bodyMedium" style={styles.name}>{c.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {c.reward} · {c.cadence ?? "one-off"}
                      {c.photo_required ? " · 📷" : ""}
                      {exists ? " · already added" : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.actions}>
              <Button compact onPress={pickAll} disabled={busy || addable.length === 0}>
                Select all
              </Button>
              <Button mode="contained" compact onPress={() => void add()} disabled={busy || chosen.length === 0}>
                {busy ? "Adding…" : `Add ${chosen.length} chore${chosen.length === 1 ? "" : "s"}`}
              </Button>
            </View>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Rewards are suggestions; edit any chore afterwards.
            </Text>
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { borderRadius: 8, alignSelf: "flex-start" },
  card: { marginTop: 8, borderRadius: 16 },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center" },
  flex: { flex: 1 },
  name: { fontWeight: "600" },
  actions: { flexDirection: "row", justifyContent: "space-between", marginVertical: 8 },
});
