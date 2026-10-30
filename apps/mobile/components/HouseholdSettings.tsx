import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Button,
  Dialog,
  IconButton,
  Portal,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";
import type { Household } from "@paydirt/shared";
import { CURRENCY_PRESETS, DEFAULT_CURRENCY_NAME, screenRate, errorMessage, featureTip } from "@paydirt/shared";
import { client } from "../lib/client";

/** Setting label with an info icon that reveals the shared feature tip inline (no hover on touch). */
function SettingLabel({ label, tip }: { label: string; tip?: string }) {
  const [shown, setShown] = useState(false);
  const text = tip ? featureTip(tip) : undefined;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text variant="labelLarge">{label}</Text>
        {text ? (
          <IconButton
            icon="information-outline"
            size={16}
            accessibilityLabel={`About ${label}`}
            onPress={() => setShown((v) => !v)}
            style={{ margin: 0 }}
          />
        ) : null}
      </View>
      {shown && text ? (
        <Text variant="bodySmall" style={{ marginBottom: 4 }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

export function HouseholdSettings({
  household,
  visible,
  onDismiss,
  onSaved,
}: {
  household: Household;
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    currency_name: household.currency_name ?? "",
    bank_threshold: String(household.bank_threshold ?? 0),
    expiry_days: String(household.expiry_days ?? 0),
    goods_rate: String(household.goods_rate ?? 0),
    screen_rate: String(screenRate(household)),
    nudge_hours: String(household.nudge_hours ?? 0),
    paused: household.paused ?? false,
    quiet_start: household.quiet_start ?? "",
    quiet_end: household.quiet_end ?? "",
    streak_bonus_3: String(household.streak_bonus_3 ?? 0),
    streak_bonus_7: String(household.streak_bonus_7 ?? 0),
    streak_bonus_14: String(household.streak_bonus_14 ?? 0),
    streak_bonus_30: String(household.streak_bonus_30 ?? 0),
    allowance_amount: String(household.allowance_amount ?? 0),
    allowance_cadence: household.allowance_cadence ?? "weekly",
  });

  const num = (v: string) => (Number(v) >= 0 ? Number(v) : 0);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await client.updateHousehold(household.id, {
        currency_name: form.currency_name.trim(),
        bank_threshold: num(form.bank_threshold),
        expiry_days: num(form.expiry_days),
        goods_rate: num(form.goods_rate),
        screen_rate: num(form.screen_rate),
        nudge_hours: num(form.nudge_hours),
        paused: form.paused,
        quiet_start: form.quiet_start,
        quiet_end: form.quiet_end,
        streak_bonus_3: num(form.streak_bonus_3),
        streak_bonus_7: num(form.streak_bonus_7),
        streak_bonus_14: num(form.streak_bonus_14),
        streak_bonus_30: num(form.streak_bonus_30),
        allowance_amount: num(form.allowance_amount),
        allowance_cadence: form.allowance_cadence === "daily" ? "daily" : "weekly",
      });
      onSaved();
      onDismiss();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: "90%" }}>
        <Dialog.Title>Household settings</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 8 }}>
            <SettingLabel label="Currency name" tip="currency_name" />
            <TextInput
              value={form.currency_name}
              placeholder={DEFAULT_CURRENCY_NAME}
              onChangeText={(v) => setForm({ ...form, currency_name: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Presets" tip="currency_presets" />
            <ScrollView horizontal style={{ marginBottom: 8 }}>
              {CURRENCY_PRESETS.map((p) => (
                <Button
                  key={p}
                  compact
                  mode={form.currency_name.trim() === p ? "contained" : "outlined"}
                  onPress={() => setForm({ ...form, currency_name: p })}
                  style={{ marginRight: 4 }}
                >
                  {p}
                </Button>
              ))}
            </ScrollView>

            <SettingLabel label="Bank threshold (0 = off)" tip="bank_threshold" />
            <TextInput
              keyboardType="numeric"
              value={form.bank_threshold}
              onChangeText={(v) => setForm({ ...form, bank_threshold: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Rewards expire after days (0 = off)" tip="expiry_days" />
            <TextInput
              keyboardType="numeric"
              value={form.expiry_days}
              onChangeText={(v) => setForm({ ...form, expiry_days: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Bucks per $1 (0 = off)" tip="goods_rate" />
            <TextInput
              keyboardType="numeric"
              value={form.goods_rate}
              onChangeText={(v) => setForm({ ...form, goods_rate: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Bucks per screen-time minute" tip="screen_rate" />
            <TextInput
              keyboardType="numeric"
              value={form.screen_rate}
              onChangeText={(v) => setForm({ ...form, screen_rate: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Nudge after hours unapproved (0 = off)" tip="nudge_hours" />
            <TextInput
              keyboardType="numeric"
              value={form.nudge_hours}
              onChangeText={(v) => setForm({ ...form, nudge_hours: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Quiet hours start" tip="quiet_start" />
            <TextInput
              value={form.quiet_start}
              onChangeText={(v) => setForm({ ...form, quiet_start: v })}
              placeholder="21:00"
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Quiet hours end" tip="quiet_end" />
            <TextInput
              value={form.quiet_end}
              onChangeText={(v) => setForm({ ...form, quiet_end: v })}
              placeholder="07:00"
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Vacation mode" tip="paused" />
            <Switch
              value={form.paused}
              onValueChange={(v) => setForm({ ...form, paused: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Allowance amount (0 = off)" tip="allowance_amount" />
            <TextInput
              keyboardType="numeric"
              value={form.allowance_amount}
              onChangeText={(v) => setForm({ ...form, allowance_amount: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Allowance cadence" tip="allowance_cadence" />
            <TextInput
              value={form.allowance_cadence}
              onChangeText={(v) => setForm({ ...form, allowance_cadence: v === "daily" ? "daily" : "weekly" })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Streak bonuses (3/7/14/30)" tip="streak_bonus_3" />
            <SettingLabel label="3-day bonus" tip="streak_bonus_3" />
            <TextInput
              keyboardType="numeric"
              value={form.streak_bonus_3}
              onChangeText={(v) => setForm({ ...form, streak_bonus_3: v })}
              style={{ marginBottom: 4 }}
            />
            <SettingLabel label="7-day bonus" tip="streak_bonus_7" />
            <TextInput
              keyboardType="numeric"
              value={form.streak_bonus_7}
              onChangeText={(v) => setForm({ ...form, streak_bonus_7: v })}
              style={{ marginBottom: 4 }}
            />
            <SettingLabel label="14-day bonus" tip="streak_bonus_14" />
            <TextInput
              keyboardType="numeric"
              value={form.streak_bonus_14}
              onChangeText={(v) => setForm({ ...form, streak_bonus_14: v })}
              style={{ marginBottom: 4 }}
            />
            <SettingLabel label="30-day bonus" tip="streak_bonus_30" />
            <TextInput
              keyboardType="numeric"
              value={form.streak_bonus_30}
              onChangeText={(v) => setForm({ ...form, streak_bonus_30: v })}
              style={{ marginBottom: 8 }}
            />
            {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>
            Cancel
          </Button>
          <Button onPress={save} disabled={busy} loading={busy}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
