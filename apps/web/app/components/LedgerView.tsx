"use client";

import { useEffect, useState } from "react";
import type { CurrencyTransaction, User } from "@paydirt/shared";
import { client } from "../lib/client";
import { currencyDisplayName } from "@paydirt/shared";
import type { Household } from "@paydirt/shared";

export function LedgerView({ household }: { household: Household | null }) {
  const [kids, setKids] = useState<User[]>([]);
  const [kidId, setKidId] = useState<string>("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [txns, setTxns] = useState<CurrencyTransaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!household) return;
    void client.listChildren(household.id).then((k) => {
      setKids(k);
      if (k.length && !kidId) setKidId(k[0].id);
    });
  }, [household]);

  useEffect(() => {
    if (!kidId) return;
    setBusy(true);
    setError("");
    void client
      .listTransactionsForMonth(kidId, year, month)
      .then(setTxns)
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  }, [kidId, year, month]);

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
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={kidId} onChange={(e) => setKidId(e.target.value)}>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.display_name}
            </option>
          ))}
        </select>
        <button className="sm" onClick={() => shiftMonth(-1)}>◀</button>
        <span style={{ fontWeight: 600 }}>
          {new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button className="sm" onClick={() => shiftMonth(1)}>▶</button>
      </div>

      {error && <p className="error">{error}</p>}
      {busy && <p className="muted">Loading…</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Date</th>
            <th style={{ textAlign: "left" }}>Type</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th style={{ textAlign: "left" }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id} style={{ borderTop: "1px solid var(--border, #eee)" }}>
              <td>{t.created.slice(0, 10)}</td>
              <td>{t.type}</td>
              <td style={{ textAlign: "right", color: t.amount >= 0 ? "green" : "red" }}>
                {t.amount >= 0 ? "+" : ""}
                {t.amount} {currency}
              </td>
              <td>{t.reason}</td>
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
