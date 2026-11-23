"use client";

import { useState } from "react";
import { errorMessage } from "@paydirt/shared";
import { client } from "../lib/client";

export function DeliverNowButton({ id, collection, overridden, onQueued }: {
  id: string; collection: "time_grants" | "spend_requests"; overridden?: boolean; onQueued: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  return <div>
    <button className="sm" disabled={busy || accepted || overridden} onClick={async () => {
      if (!window.confirm("Deliver the remaining minutes now, outside PayDirt's allowed hours? Your regular schedule stays the same. Family Link restrictions still apply.")) return;
      setBusy(true); setError("");
      try { await client.deliverGrantNow(collection, id); setAccepted(true); await onQueued(); }
      catch (e) { setError(errorMessage(e)); }
      finally { setBusy(false); }
    }}>{accepted || overridden ? "Delivery override enabled" : busy ? "Queueing delivery…" : "Deliver now"}</button>
    {!!error && <p role="alert">{error}</p>}
  </div>;
}
