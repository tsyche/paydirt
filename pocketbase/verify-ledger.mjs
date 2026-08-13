// Ledger integrity check. Recomputes every user's parentBucks balance from
// currency_transactions and diffs it against the cached `balance` field,
// catching silent drift if a PocketBase hook throws mid-transaction. Exits
// non-zero on any mismatch. Diff logic lives in packages/shared/src/ledger.ts.
//
// Requires a RUNNING PocketBase (talks to the HTTP API). Run via `just verify-ledger`.
//
// Env overrides (all optional, defaults target local dev):
//   PB_URL            default http://127.0.0.1:8090
//   PB_ADMIN_EMAIL    default admin@paydirt.local
//   PB_ADMIN_PASSWORD default password123

import PocketBase from "pocketbase";
import { verifyLedger } from "../packages/shared/src/ledger.ts";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "password123";

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const [users, transactions] = await Promise.all([
    pb.collection("users").getFullList({ fields: "id,balance,display_name" }),
    pb.collection("currency_transactions").getFullList({ fields: "user,amount" }),
  ]);

  const mismatches = verifyLedger(users, transactions);

  if (mismatches.length === 0) {
    console.log(
      `Ledger OK — ${users.length} users, ${transactions.length} transactions, all balances match.`,
    );
    return;
  }

  console.error(`Ledger integrity check FAILED — ${mismatches.length} mismatch(es):`);
  for (const m of mismatches) {
    const label = users.find((u) => u.id === m.userId)?.display_name ?? m.userId;
    console.error(
      `  ${label} (${m.userId}): cached=${m.cachedBalance} computed=${m.computedBalance} delta=${m.delta}`,
    );
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify-ledger failed:", err?.message ?? err);
  process.exitCode = 1;
});
