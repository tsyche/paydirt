import PocketBase from "pocketbase";

// Admin-backed cleanup for the live integration suites. Tests create real
// chores/assignments against the dev server; parent credentials can't fully
// remove them (transactions have no update rule, and a referenced assignment
// can't be deleted), so cleanup runs as the superuser: unlink ledger refs
// (the append-only rows themselves stay), delete assignments, delete chores.
// Same env defaults as pocketbase/seed.mjs.

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "password123";

export async function cleanupChores(choreIds: string[]): Promise<void> {
  if (choreIds.length === 0) return;
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  for (const choreId of choreIds) {
    const assignments = await pb.collection("assignments").getFullList({
      filter: pb.filter("chore = {:c}", { c: choreId }),
    });
    for (const a of assignments) {
      const txs = await pb.collection("currency_transactions").getFullList({
        filter: pb.filter("related_assignment = {:a}", { a: a.id }),
      });
      for (const t of txs) {
        await pb.collection("currency_transactions").update(t.id, { related_assignment: null });
      }
      const grants = await pb.collection("time_grants").getFullList({
        filter: pb.filter("assignment = {:a}", { a: a.id }),
      });
      for (const g of grants) await pb.collection("time_grants").delete(g.id);
      await pb.collection("assignments").delete(a.id);
    }
    await pb.collection("chores").delete(choreId);
  }
}

export async function cleanupSpendRequests(spendRequestIds: string[]): Promise<void> {
  if (spendRequestIds.length === 0) return;
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  for (const id of spendRequestIds) {
    const txs = await pb.collection("currency_transactions").getFullList({
      filter: pb.filter("related_spend_request = {:s}", { s: id }),
    });
    for (const t of txs) {
      await pb.collection("currency_transactions").update(t.id, { related_spend_request: null });
    }
    await pb.collection("spend_requests").delete(id);
  }
}

export async function adminPb(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  return pb;
}

/** Delete throwaway users (after their chores are cleaned up). Ledger rows go with them; best-effort. */
export async function cleanupUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const pb = await adminPb();
  for (const id of userIds) {
    const txs = await pb.collection("currency_transactions").getFullList({
      filter: pb.filter("user = {:u}", { u: id }),
    });
    for (const t of txs) await pb.collection("currency_transactions").delete(t.id).catch(() => {});
    const grants = await pb.collection("time_grants").getFullList({ filter: pb.filter("child = {:u}", { u: id }) });
    for (const g of grants) await pb.collection("time_grants").delete(g.id).catch(() => {});
    await pb.collection("users").delete(id).catch(() => {});
  }
}
