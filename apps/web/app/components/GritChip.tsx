"use client";

import { useEffect, useState } from "react";
import type { Household, User } from "@paydirt/shared";
import { bankSummary, currencyDisplayName, screenRate } from "@paydirt/shared";

const usd = (n: number | null) => (n === null ? "" : ` · $${n.toFixed(2)}`);

/** Header grit total; click for grit, dollars and screen minutes per kid and combined. */
export function GritChip({ household, kids }: { household: Household | null; kids: User[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const currency = currencyDisplayName(household);
  const bank = bankSummary(kids, household?.goods_rate ?? 0, screenRate(household));
  const line = (n: number, dollars: number | null, minutes: number) => `${n} ${currency}${usd(dollars)} · ≈${minutes} min`;
  return (
    <>
      <button
        className="grit-chip"
        data-testid="grit-chip"
        aria-label={`${currency}: ${bank.rows.map((r) => `${r.name} ${r.balance}`).join(", ")}`}
        onClick={() => setOpen(true)}
      >
        🪙 <span className="grit-num">{bank.total.balance}</span>
      </button>
      {open && (
        <div className="settings-panel overview-modal" role="dialog" aria-modal="true" aria-label={currency}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>🪙 {currency}</h3>
            <button className="outlined sm" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="stack" style={{ gap: 6 }} data-testid="grit-modal">
            {bank.rows.map((r) => (
              <div key={r.id}>{r.name}: {line(r.balance, r.dollars, r.screenMinutes)}</div>
            ))}
            {bank.rows.length > 1 && (
              <strong>Total: {line(bank.total.balance, bank.total.dollars, bank.total.screenMinutes)}</strong>
            )}
            <span className="muted">Screen time is what it could buy; a request still needs approval.</span>
          </div>
        </div>
      )}
    </>
  );
}
