import { useState } from "react";
import { partialPay, type Chore } from "@paydirt/shared";

export function PartialCredit({ chore, currency, onApprove }: {
  chore: Chore; currency: string; onApprove: (percent: number) => void;
}) {
  const [percent, setPercent] = useState(50);
  const pay = partialPay(chore, percent);
  return <details>
    <summary>Partial credit</summary>
    {[25, 50, 75].map((n) => <button key={n} onClick={() => setPercent(n)}>{n}%</button>)}
    <input aria-label="Credit percent" type="number" min={1} max={99} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
    <p>{pay.bucks} {currency} + {pay.minutes} min. Closes the chore; no remainder owed.</p>
    <button disabled={!Number.isInteger(percent) || percent < 1 || percent > 99 || (pay.bucks <= 0 && pay.minutes <= 0)}
      onClick={() => {
        if (window.confirm(`Approve ${percent}%: ${pay.bucks} ${currency} + ${pay.minutes} min? This closes the chore. Time grants cannot be undone.`)) onApprove(percent);
      }}>Approve {percent}%</button>
  </details>;
}
