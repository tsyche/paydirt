"use client";

import { useCallback, useEffect, useState } from "react";
import { deliveryWindowLabel, errorMessage, householdDateTime, timeBankEventLabel, timeBankTotals, timeDeliveryOutcome } from "@paydirt/shared";
import { client } from "../lib/client";

type Bank = Awaited<ReturnType<typeof client.getTimeBank>>;

export function EarnedTimeBank({ childId }: { childId: string }) {
  const [historyLimit, setHistoryLimit] = useState(5);
  const [deliveryLimit, setDeliveryLimit] = useState(5);
  const [bank, setBank] = useState<Bank | null>(null);
  const [deliveryWindow, setDeliveryWindow] = useState<Awaited<ReturnType<typeof client.getDeliveryWindow>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try { setBank(await client.getTimeBank(childId)); setError(""); }
    catch (e) { setError(errorMessage(e)); }
    // Display-only; a failure here must not block the bank.
    try { setDeliveryWindow(await client.getDeliveryWindow(childId)); } catch { setDeliveryWindow(null); }
  }, [childId]);
  useEffect(() => {
    void reload();
    const catchUp = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("online", catchUp);
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void client.subscribeToKidUpdates(childId, () => { void reload(); }).then((stop) => {
      if (active) unsubscribe = stop; else stop();
    }).catch((e) => setError(errorMessage(e)));
    return () => {
      active = false; unsubscribe?.();
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("online", catchUp);
    };
  }, [childId, reload]);
  const totals = bank && timeBankTotals(bank.ledger, bank.grants, bank.purchases);
  const waiting = bank?.grants.filter((g) => g.grant_status === "queued" && !g.grant_window_override) ?? [];
  const queuedCount = bank?.grants.filter((g) => g.grant_status === "queued").length ?? 0;
  async function deliverAll() {
    if (!window.confirm(`Deliver ${waiting.length} queued grant${waiting.length === 1 ? "" : "s"} now, outside allowed hours? Your regular schedule stays the same. Family Link restrictions still apply.`)) return;
    setBusy(true); setError("");
    try { for (const grant of waiting) await client.deliverGrantNow("time_grants", grant.id); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); await reload(); }
  }
  return <section aria-label="Saved earned time">
    <details>
      <summary>{totals ? `Banked time: ${totals.available} min` : error ? "Banked time unavailable" : "Loading banked time…"}</summary>
      {deliveryWindow && <p aria-label="Delivery window">{deliveryWindowLabel(deliveryWindow, queuedCount)}</p>}
      {waiting.length > 0 && <button className="sm" disabled={busy} onClick={() => void deliverAll()}>{busy ? "Queueing delivery…" : "Deliver all queued now"}</button>}
      {totals && <div aria-label="Earned time totals" style={{ display: "grid", gap: 4, margin: "8px 0" }}>
        <div>{totals.available} min saved</div>
        <div>{totals.reserved} min reserved for review</div>
        <div>{totals.requested} min requested</div>
        <div>{totals.queued} min queued</div>
      </div>}
    {bank && bank.grants.length > 0 && <div aria-label="Time delivery results">
      <strong>Time delivery</strong>
      {bank.grants.slice(0, deliveryLimit).map((grant) => {
        const outcome = timeDeliveryOutcome(grant);
        return <div key={grant.id}>
          <p>{grant.minutes} minutes requested · {outcome.title}</p>
          <p>{outcome.detail}</p>
          <p>{householdDateTime(grant.created)}</p>
        </div>;
      })}
      {bank.grants.length > deliveryLimit && <button onClick={() => setDeliveryLimit(deliveryLimit + 10)}>Show more time deliveries</button>}
    </div>}
    {error && <p role="alert">{error}</p>}
    {bank && <div><strong>Earned-time history</strong>
      <p>Saved time stays held until the kid uses it. Queued time follows delivery windows. No extra Grit charge.</p>
      {bank.ledger.length === 0 && <p>No earned minutes yet.</p>}
      {bank.ledger.slice(0, historyLimit).map((row) => <p key={row.id}>{householdDateTime(row.created)} · {timeBankEventLabel(row.kind)} · {row.minutes} min</p>)}
      {bank.ledger.length > historyLimit && <button onClick={() => setHistoryLimit(historyLimit + 10)}>Show more earned-time history</button>}
    </div>}
    </details>
  </section>;
}
