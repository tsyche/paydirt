/// <reference path="../pb_data/types.d.ts" />

// Currency logic: the ledger drives the cached balance, and approvals
// auto-create ledger entries. See docs/DATA_MODEL.md.

// ── currency_transactions create → maintain cached user balance ──────────────
// Single point where users.balance changes. Transactions are append-only so the
// cache can't drift.
onRecordAfterCreateSuccess((e) => {
  const amount = e.record.getFloat("amount");
  const user = e.app.findRecordById("users", e.record.getString("user"));
  user.set("balance", user.getFloat("balance") + amount);
  e.app.save(user);
  e.next();
}, "currency_transactions");

// ── spend_requests → approved: guard sufficient balance (before save) ────────
onRecordUpdate((e) => {
  const becameApproved =
    e.record.getString("status") === "approved" &&
    e.record.original().getString("status") !== "approved";
  if (becameApproved) {
    const child = e.app.findRecordById("users", e.record.getString("child"));
    if (child.getFloat("balance") < e.record.getFloat("amount")) {
      throw new BadRequestError("Insufficient balance to approve this spend request.");
    }
  }
  e.next();
}, "spend_requests");

// ── assignments → approved: create an earn transaction for the chore reward ──
onRecordAfterUpdateSuccess((e) => {
  const becameApproved =
    e.record.getString("status") === "approved" &&
    e.record.original().getString("status") !== "approved";
  if (becameApproved) {
    const chore = e.app.findRecordById("chores", e.record.getString("chore"));
    const tx = new Record(e.app.findCollectionByNameOrId("currency_transactions"));
    tx.set("user", e.record.getString("child"));
    tx.set("amount", chore.getFloat("reward"));
    tx.set("type", "earn");
    tx.set("reason", "Chore: " + chore.getString("name"));
    tx.set("related_assignment", e.record.id);
    e.app.save(tx);
  }
  e.next();
}, "assignments");

// ── spend_requests → approved: create a spend transaction (negative) ─────────
onRecordAfterUpdateSuccess((e) => {
  const becameApproved =
    e.record.getString("status") === "approved" &&
    e.record.original().getString("status") !== "approved";
  if (becameApproved) {
    const tx = new Record(e.app.findCollectionByNameOrId("currency_transactions"));
    tx.set("user", e.record.getString("child"));
    tx.set("amount", -e.record.getFloat("amount"));
    tx.set("type", "spend");
    tx.set("reason", e.record.getString("description"));
    tx.set("related_spend_request", e.record.id);
    e.app.save(tx);
  }
  e.next();
}, "spend_requests");
