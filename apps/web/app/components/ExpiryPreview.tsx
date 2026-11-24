"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@paydirt/shared";
import { client } from "../lib/client";

type Preview = Awaited<ReturnType<typeof client.previewExpiry>>;

export function ExpiryPreview({ householdId, days, currency, paused, onReady }: {
  householdId: string; days: number; currency: string; paused: boolean; onReady: (days: number | null) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    onReady(null); setError("");
    const timer = setTimeout(() => {
      void client.previewExpiry(householdId, days).then((value) => {
        if (live) { setPreview(value); onReady(days); }
      }).catch((e) => { if (live) setError(errorMessage(e)); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [householdId, days, onReady]);
  return <div role="status" aria-label="Reward expiry preview">
    {error ? <p className="error">Expiry preview unavailable: {error}. Change the days to retry.</p>
      : preview?.days !== days ? <p>Checking expiry…</p>
      : <><p>Expiry preview — {days === 0 ? "expiry is off" : "unspent earnings that would expire today"}:</p>
        {preview.children.map((kid) => <p key={kid.id}>{kid.display_name}: {kid.lapse} {currency} would expire today</p>)}
        <p className="muted">Estimate from the current ledger; saving does not deduct rewards. {paused ? "No rewards expire while the household is paused." : "Scheduled expiry uses the balance at the time it runs."}</p></>}
  </div>;
}
