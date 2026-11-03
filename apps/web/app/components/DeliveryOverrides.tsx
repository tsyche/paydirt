import { useState } from "react";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";
export function DeliveryOverrides({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const [weekday, setWeekday] = useState(kid.grant_weekday_window ?? "");
  const [weekend, setWeekend] = useState(kid.grant_weekend_window ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <details><summary>Time delivery overrides</summary>
    <p>Blank inherits household; 'all' allows all day.</p>
    <input aria-label="Weekday delivery override" placeholder="15:30-20:00" value={weekday} onChange={(e) => setWeekday(e.target.value)} maxLength={11} />
    <input aria-label="Weekend delivery override" placeholder="08:00-20:00" value={weekend} onChange={(e) => setWeekend(e.target.value)} maxLength={11} />
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        await client.pb.collection("users").update(kid.id, { grant_weekday_window: weekday.trim(), grant_weekend_window: weekend.trim() });
        onSaved(); setMessage("Delivery windows saved.");
      } catch { setMessage("Could not save. Use HH:MM-HH:MM, 'all', or blank."); }
      finally { setBusy(false); }
    }}>Save delivery windows</button>
    <p role="status">{message}</p>
  </details>;
}
