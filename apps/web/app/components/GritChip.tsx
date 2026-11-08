"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { Household, User } from "@paydirt/shared";
import { bankSummary, currencyDisplayName, screenRate } from "@paydirt/shared";

// Material Design Icons 'cash' (Apache-2.0); matches mobile's cash glyph.
// Source: https://github.com/Templarian/MaterialDesign/blob/master/svg/cash.svg
// License: ./icons/LICENSE.txt
function CashIcon() {
  return <svg data-icon="cash" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: "middle" }}>
    <path d="M3,6H21V18H3V6M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M7,8A2,2 0 0,1 5,10V14A2,2 0 0,1 7,16H17A2,2 0 0,1 19,14V10A2,2 0 0,1 17,8H7Z" />
  </svg>;
}

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
        <CashIcon /> <span className="grit-num">{bank.total.balance}</span>
      </button>
      {open && createPortal(
        <div className="settings-panel overview-modal" role="dialog" aria-modal="true" aria-label={currency}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}><CashIcon /> {currency}</h3>
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
        </div>, document.body
      )}
    </>
  );
}
