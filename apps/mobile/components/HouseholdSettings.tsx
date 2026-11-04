import { DeliverySchedule } from "./DeliverySchedule";
import { useState, type ReactNode } from "react";
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
import { CURRENCY_PRESETS, DEFAULT_CURRENCY_NAME, currencyDisplayName, screenRate, errorMessage, featureTip, kudosDefaultBucks } from "@paydirt/shared";
import { client } from "../lib/client";

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={{ marginVertical: 8, borderWidth: 1, borderColor: "#888", borderRadius: 12 }}>
    <Button mode="text" icon={open ? "chevron-down" : "chevron-right"} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} contentStyle={{ justifyContent: "flex-start", minHeight: 48 }}>{title}</Button>
    <View style={{ display: open ? "flex" : "none", padding: 12 }}>{children}</View>
  </View>;
}

/** Setting label with an info icon that reveals the shared feature tip inline (no hover on touch). */
function SettingLabel({ label, tip }: { label: string; tip?: string }) {
  const [shown, setShown] = useState(false);
  const text = tip ? featureTip(tip) : undefined;
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
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
    kudos_default_bucks: String(kudosDefaultBucks(household)),
    grant_weekday_window: household.grant_weekday_window ?? "",
    grant_day_windows: household.grant_day_windows ?? "",
    grant_weekend_window: household.grant_weekend_window ?? "",
    grant_timezone: household.grant_timezone || "America/Los_Angeles",
    grant_expiry_days: String(household.grant_expiry_days ?? 0),
    expiry_days: String(household.expiry_days ?? 0),
    goods_rate: String(household.goods_rate ?? 0),
    screen_rate: String(screenRate(household)),
    nudge_hours: String(household.nudge_hours ?? 0),
    paused: household.paused ?? false,
    kids_see_balances: household.kids_see_balances ?? false,
    quiet_start: household.quiet_start ?? "",
    quiet_end: household.quiet_end ?? "",
    streak_bonus_3: String(household.streak_bonus_3 ?? 0),
    streak_bonus_7: String(household.streak_bonus_7 ?? 0),
    streak_bonus_14: String(household.streak_bonus_14 ?? 0),
    streak_bonus_30: String(household.streak_bonus_30 ?? 0),
    allowance_amount: String(household.allowance_amount ?? 0),
    allowance_cadence: household.allowance_cadence ?? "weekly",
  });
  // Labels follow the currency name as it is typed, not the saved one.
  const cur = currencyDisplayName({ currency_name: form.currency_name });

  const num = (v: string) => (Number(v) >= 0 ? Number(v) : 0);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await client.updateHousehold(household.id, {
        currency_name: form.currency_name.trim(),
        bank_threshold: num(form.bank_threshold),
        kudos_default_bucks: Math.max(1, num(form.kudos_default_bucks)),
        grant_weekday_window: form.grant_weekday_window.trim(),
        grant_day_windows: form.grant_day_windows,
        grant_weekend_window: form.grant_weekend_window.trim(),
        grant_timezone: form.grant_timezone.trim(),
        grant_expiry_days: num(form.grant_expiry_days),
        expiry_days: num(form.expiry_days),
        goods_rate: num(form.goods_rate),
        screen_rate: num(form.screen_rate),
        nudge_hours: num(form.nudge_hours),
        paused: form.paused,
        kids_see_balances: form.kids_see_balances,
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
            <SettingsGroup title="Currency">
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

            </SettingsGroup>
            <SettingsGroup title="Screen-time delivery">
            <TextInput style={{ marginBottom: 12 }} label="Queued grant expires after days (0 = never)" keyboardType="number-pad" value={form.grant_expiry_days} onChangeText={(v) => setForm({ ...form, grant_expiry_days: v })} />
            <DeliverySchedule value={form} onChange={(schedule) => setForm((old) => ({ ...old, ...schedule }))} />
            </SettingsGroup>
            <SettingsGroup title="Rewards and conversion">
            <SettingLabel label="Bank threshold (0 = off)" tip="bank_threshold" />
            <TextInput
              keyboardType="numeric"
              value={form.bank_threshold}
              onChangeText={(v) => setForm({ ...form, bank_threshold: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Kudos default amount" tip="kudos_default_bucks" />
            <TextInput
              keyboardType="numeric"
              value={form.kudos_default_bucks}
              onChangeText={(v) => setForm({ ...form, kudos_default_bucks: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Rewards expire after days (0 = off)" tip="expiry_days" />
            <TextInput
              keyboardType="numeric"
              value={form.expiry_days}
              onChangeText={(v) => setForm({ ...form, expiry_days: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label={`${cur} per $1 (0 = off)`} tip="goods_rate" />
            <TextInput
              keyboardType="numeric"
              value={form.goods_rate}
              onChangeText={(v) => setForm({ ...form, goods_rate: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label={`${cur} per screen-time minute`} tip="screen_rate" />
            <TextInput
              keyboardType="numeric"
              value={form.screen_rate}
              onChangeText={(v) => setForm({ ...form, screen_rate: v })}
              style={{ marginBottom: 8 }}
            />
            </SettingsGroup>
            <SettingsGroup title="Notifications">
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
            </SettingsGroup>
            <SettingsGroup title="Household preferences">
            <Text style={{ marginBottom: 12 }}>The household timezone applies to chore resets, schedules, reminders, reports, and dates.</Text>
            <TextInput style={{ marginBottom: 12 }} label="Household timezone" placeholder="America/Los_Angeles" value={form.grant_timezone} onChangeText={(v) => setForm({ ...form, grant_timezone: v })} />
            <SettingLabel label="Vacation mode" tip="paused" />
            <Switch
              value={form.paused}
              onValueChange={(v) => setForm({ ...form, paused: v })}
              style={{ marginBottom: 8 }}
            />
            <SettingLabel label="Kids see each other's balance" tip="kids_see_balances" />
            <Switch
              value={form.kids_see_balances}
              onValueChange={(v) => setForm({ ...form, kids_see_balances: v })}
              style={{ marginBottom: 8 }}
            />
            </SettingsGroup>
            <SettingsGroup title="Allowance">
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
            </SettingsGroup>
            <SettingsGroup title="Streak bonuses">
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
            </SettingsGroup>
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
