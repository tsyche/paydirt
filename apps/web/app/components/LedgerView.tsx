"use client";

import { useEffect, useState } from "react";
import type { CurrencyTransaction, User } from "@paydirt/shared";
import { householdDateTime, householdWallDate } from "@paydirt/shared";
import { client } from "../lib/client";
import { currencyDisplayName, errorMessage } from "@paydirt/shared";
import type { Household } from "@paydirt/shared";

export const ALL_KIDS = "all";

export function LedgerView({ household, initialKidId }: { household: Household | null; initialKidId?: string }) {
  const [kids, setKids] = useState<User[]>([]);
  const [kidId, setKidId] = useState<string>(initialKidId ?? ALL_KIDS);
  const [year, setYear] = useState(householdWallDate().getFullYear());
  const [month, setMonth] = useState(householdWallDate().getMonth() + 1);
  const [txns, setTxns] = useState<CurrencyTransaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!household) return;
    void client.listChildren(household.id).then((k) => {
      setKids(k);
    });
  }, [household]);

  useEffect(() => {
    if (kidId === ALL_KIDS && kids.length === 0) return;
    setBusy(true);
    setError("");
    void (kidId === ALL_KIDS
      ? client.listTransactionsForMonthMulti(kids.map((k) => k.id), year, month)
      : client.listTransactionsForMonth(kidId, year, month))
      .then(setTxns)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  }, [kidId, kids, year, month]);

  const currency = currencyDisplayName(household);
  const total = txns.reduce((s, t) => s + t.amount, 0);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="ledger-controls">
        <select value={kidId} onChange={(e) => setKidId(e.target.value)}>
          <option value={ALL_KIDS}>All kids</option>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.display_name}
            </option>
          ))}
        </select>
        <div className="ledger-month-switcher">
        <button className="sm" aria-label="Previous month" onClick={() => shiftMonth(-1)}>◀</button>
        <span style={{ fontWeight: 600 }}>
          {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button className="sm" aria-label="Next month" onClick={() => shiftMonth(1)}>▶</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {busy && <p className="muted">Loading…</p>}

      <table className="data-table ledger-table">
        <thead>
          <tr>
            <th>Date and time</th>
            {kidId === ALL_KIDS && <th>Kid</th>}
            <th>Type</th>
            <th>Amount</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id}>
              <td data-label="Date and time">{householdDateTime(t.created)}</td>
              {kidId === ALL_KIDS && <td data-label="Kid">{kids.find((k) => k.id === t.user)?.display_name ?? ""}</td>}
              <td data-label="Type"><span className={`type-chip type-${t.type}`}>{t.type.replace("_", " ")}</span></td>
              <td data-label="Amount" className={`num ${t.amount >= 0 ? "pos" : "neg"}`}>
                {t.amount >= 0 ? "+" : ""}
                {t.amount} {currency}
              </td>
              <td data-label="Reason">{t.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {txns.length === 0 && !busy && <p className="muted">No transactions this month.</p>}

      <div style={{ fontWeight: 600, marginTop: 8 }}>
        Month net: {total >= 0 ? "+" : ""}
        {total} {currency}
      </div>
    </div>
  );
}
