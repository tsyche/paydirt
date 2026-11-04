import { useState } from "react";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";
import { TimeRangeField } from "./TimeRangeField";
export function DeliveryOverrides({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const [weekday, setWeekday] = useState(kid.grant_weekday_window ?? "");
  const [weekend, setWeekend] = useState(kid.grant_weekend_window ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <details><summary>Time delivery overrides</summary>
    <p>Blank inherits household; 'all' allows all day.</p>
    <div className="time-range-row"><span>Weekday</span><TimeRangeField label="Weekday delivery override" value={weekday} onChange={setWeekday} allowAll /></div>
    <div className="time-range-row"><span>Weekend</span><TimeRangeField label="Weekend delivery override" value={weekend} onChange={setWeekend} allowAll /></div>
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        await client.pb.collection("users").update(kid.id, { grant_weekday_window: weekday.trim(), grant_weekend_window: weekend.trim() });
        onSaved(); setMessage("Delivery windows saved.");
      } catch { setMessage("Could not save. Pick both a start and end time, or clear it."); }
      finally { setBusy(false); }
    }}>Save delivery windows</button>
    <p role="status">{message}</p>
  </details>;
}
