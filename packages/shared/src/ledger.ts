// Ledger integrity check: currency_transactions is append-only and drives
// each user's cached `balance` (see pocketbase/pb_hooks/currency.pb.js). If a
// hook throws mid-transaction, the cache and the ledger can silently diverge
// with nothing to catch it — this recomputes the truth from the ledger and
// diffs it against the cache. See docs/DATA_MODEL.md.

export interface LedgerMismatch {
  userId: string;
  cachedBalance: number;
  computedBalance: number;
  delta: number;
}

const EPSILON = 1e-9;

/**
 * Recomputes each user's balance as the sum of their currency_transactions
 * and diffs it against the cached value. Returns only the mismatches — an
 * empty array means the ledger is clean.
 */
export function verifyLedger(
  users: Array<{ id: string; balance: number }>,
  transactions: Array<{ user: string; amount: number }>,
): LedgerMismatch[] {
  const computed = new Map<string, number>();
  for (const tx of transactions) {
    computed.set(tx.user, (computed.get(tx.user) ?? 0) + tx.amount);
  }

  const mismatches: LedgerMismatch[] = [];
  for (const user of users) {
    const computedBalance = computed.get(user.id) ?? 0;
    const delta = user.balance - computedBalance;
    if (Math.abs(delta) > EPSILON) {
      mismatches.push({ userId: user.id, cachedBalance: user.balance, computedBalance, delta });
    }
  }
  return mismatches;
}
