import { DeliverySchedule } from "./DeliverySchedule";
import { useState } from "react";
import { Button, Text } from "react-native-paper";
import { errorMessage, type User } from "@paydirt/shared";
import { client } from "../lib/client";
export function DeliveryOverrides({ kid, onSaved }: { kid: User; onSaved: () => Promise<void> }) {
  const [weekday, setWeekday] = useState(kid.grant_weekday_window ?? "");
  const [weekend, setWeekend] = useState(kid.grant_weekend_window ?? "");
  const [days, setDays] = useState(kid.grant_day_windows ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <>
    <Text variant="titleSmall">Editing {kid.display_name}'s delivery windows</Text>
    <Button disabled={busy} onPress={async () => {
      setBusy(true);
      try {
        await client.pb.collection("users").update(kid.id, { grant_weekday_window: weekday.trim(), grant_weekend_window: weekend.trim(), grant_day_windows: days });
        await onSaved(); setMessage("Delivery windows saved.");
      } catch (e) { setMessage(errorMessage(e)); }
      finally { setBusy(false); }
    }}>Save delivery windows</Button>
    <Button disabled={busy} onPress={() => { setWeekday(kid.grant_weekday_window ?? ""); setWeekend(kid.grant_weekend_window ?? ""); setDays(kid.grant_day_windows ?? ""); setMessage(""); }}>Cancel</Button>
    <DeliverySchedule kid value={{ grant_weekday_window: weekday, grant_weekend_window: weekend, grant_day_windows: days }} onChange={(schedule) => { setWeekday(schedule.grant_weekday_window); setWeekend(schedule.grant_weekend_window); setDays(schedule.grant_day_windows); }} />
    {!!message && <Text>{message}</Text>}
  </>;
}
