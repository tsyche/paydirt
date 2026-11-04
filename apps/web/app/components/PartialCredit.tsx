import { useState } from "react";
import { partialPay, type Chore } from "@paydirt/shared";

/**
 * The percent panel overlays the approval row (absolute, see .partial-credit-panel
 * in globals.css) so opening it never moves the Approve/Reject buttons.
 */
export function PartialCredit({ chore, currency, onApprove }: {
  chore: Chore; currency: string; onApprove: (percent: number) => void;
}) {
  const [percent, setPercent] = useState(50);
  const pay = partialPay(chore, percent);
  return <details className="partial-credit">
    <summary>Partial credit</summary>
    <div className="partial-credit-panel">
      <div className="inline" style={{ gap: 6 }}>
        {[25, 50, 75].map((n) => (
          <button key={n} className={percent === n ? "tonal sm" : "sm"} onClick={() => setPercent(n)}>{n}%</button>
        ))}
        <input
          aria-label="Credit percent"
          type="number"
          min={1}
          max={99}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          style={{ width: 64 }}
        />
      </div>
      <p>{pay.bucks} {currency} + {pay.minutes} min. Closes the chore; no remainder owed.</p>
      <button
        className="primary sm"
        disabled={!Number.isInteger(percent) || percent < 1 || percent > 99 || (pay.bucks <= 0 && pay.minutes <= 0)}
        onClick={() => {
          if (window.confirm(`Approve ${percent}%: ${pay.bucks} ${currency} + ${pay.minutes} min? This closes the chore. Time grants cannot be undone.`)) onApprove(percent);
        }}
      >Approve {percent}%</button>
    </div>
  </details>;
}
