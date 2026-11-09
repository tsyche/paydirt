"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, householdDateTime, timeBankEventLabel, timeBankTotals } from "@paydirt/shared";
import { client } from "../lib/client";

type Bank = Awaited<ReturnType<typeof client.getTimeBank>>;

export function EarnedTimeBank({ childId }: { childId: string }) {
  const [historyLimit, setHistoryLimit] = useState(5);
  const [bank, setBank] = useState<Bank | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try { setBank(await client.getTimeBank(childId)); setError(""); }
    catch (e) { setError(errorMessage(e)); }
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
  return <section aria-label="Saved earned time">
    <strong>Saved earned time</strong>
    <p>{totals ? `${totals.available} min saved · ${totals.reserved} min reserved for review · ${totals.requested} min requested · ${totals.queued} min queued` : "Loading saved time…"}</p>
    {error && <p role="alert">{error}</p>}
    {bank && <details><summary>Earned-time detail and history</summary>
      <p>Saved time stays held until the kid uses it. Queued time follows delivery windows. No extra Grit charge.</p>
      {bank.ledger.length === 0 && <p>No earned minutes yet.</p>}
      {bank.ledger.slice(0, historyLimit).map((row) => <p key={row.id}>{householdDateTime(row.created)} · {timeBankEventLabel(row.kind)} · {row.minutes} min</p>)}
      {bank.ledger.length > historyLimit && <button onClick={() => setHistoryLimit(historyLimit + 10)}>Show more earned-time history</button>}
    </details>}
  </section>;
}
