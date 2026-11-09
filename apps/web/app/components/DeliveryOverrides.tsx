import { useState } from "react";
import { errorMessage, type User } from "@paydirt/shared";
import { client } from "../lib/client";
import { DeliverySchedule } from "./DeliverySchedule";
export function DeliveryOverrides({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const [weekday, setWeekday] = useState(kid.grant_weekday_window ?? "");
  const [weekend, setWeekend] = useState(kid.grant_weekend_window ?? "");
  const [days, setDays] = useState(kid.grant_day_windows ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <details><summary>Time delivery overrides</summary>
    <div className="edit-header">
    <strong>Editing {kid.display_name}'s delivery windows</strong>
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        await client.pb.collection("users").update(kid.id, { grant_weekday_window: weekday.trim(), grant_weekend_window: weekend.trim(), grant_day_windows: days });
        onSaved(); setMessage("Delivery windows saved.");
      } catch (e) { setMessage(errorMessage(e)); }
      finally { setBusy(false); }
    }}>Save delivery windows</button>
    <button disabled={busy} onClick={() => { setWeekday(kid.grant_weekday_window ?? ""); setWeekend(kid.grant_weekend_window ?? ""); setDays(kid.grant_day_windows ?? ""); setMessage(""); }}>Cancel</button>
    </div>
    <DeliverySchedule kid value={{ grant_weekday_window: weekday, grant_weekend_window: weekend, grant_day_windows: days }} onChange={(schedule) => { setWeekday(schedule.grant_weekday_window); setWeekend(schedule.grant_weekend_window); setDays(schedule.grant_day_windows); }} />
    <p role="status">{message}</p>
  </details>;
}
