import { TimeRangeField } from "./TimeField";
import { useState } from "react";
import { Button, Text } from "react-native-paper";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";
export function DeliveryOverrides({ kid, onSaved }: { kid: User; onSaved: () => Promise<void> }) {
  const [weekday, setWeekday] = useState(kid.grant_weekday_window ?? "");
  const [weekend, setWeekend] = useState(kid.grant_weekend_window ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <>
    <Text>Time delivery overrides: blank inherits household; 'all' allows all day.</Text>
    <TimeRangeField label="Weekday delivery" value={weekday} onChange={setWeekday} allowAll />
    <TimeRangeField label="Weekend delivery" value={weekend} onChange={setWeekend} allowAll />
    <Button disabled={busy} onPress={async () => {
      setBusy(true);
      try {
        await client.pb.collection("users").update(kid.id, { grant_weekday_window: weekday.trim(), grant_weekend_window: weekend.trim() });
        await onSaved(); setMessage("Delivery windows saved.");
      } catch { setMessage("Could not save delivery windows. Pick both a start and end time, or clear it."); }
      finally { setBusy(false); }
    }}>Save delivery windows</Button>
    {!!message && <Text>{message}</Text>}
  </>;
}
