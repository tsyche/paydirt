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

// ── spend_requests create (API): sanitize + price screen time ────────────────
// The client's amount/status aren't trusted: a new request is always pending
// with a positive amount, and a screen-time request is priced here from the
// household rate. Mirrors packages/shared/src/screenTime.ts.
onRecordCreateRequest((e) => {
  const r = e.record;
  r.set("status", "pending");
  r.set("resolved_at", "");
  r.set("resolved_by", "");

  const minutes = r.get("screen_minutes");
  if (minutes) {
    if ([15, 30, 45, 60].indexOf(minutes) === -1) {
      throw new BadRequestError("Screen time comes in 15, 30, 45, or 60 minutes.");
    }
    const child = e.app.findRecordById("users", r.getString("child"));
    const household = e.app.findRecordById("households", child.getString("household"));
    const rate = household.getFloat("screen_rate") > 0 ? household.getFloat("screen_rate") : 1;
    r.set("amount", Math.ceil(minutes * rate));
  } else if (!(r.getFloat("amount") > 0)) {
    throw new BadRequestError("Spend amount must be positive.");
  }
  // Can't ask for more than the kid has left after their other pending
  // requests. (Approval re-checks below; this stops doomed requests from ever
  // reaching a parent.)
  const kid = e.app.findRecordById("users", r.getString("child"));
  const pending = e.app.findRecordsByFilter(
    "spend_requests",
    "child = {:child} && status = 'pending'",
    "",
    0,
    0,
    { child: kid.id },
  );
  let committed = 0;
  for (const p of pending) committed += p.getFloat("amount");
  const available = kid.getFloat("balance") - committed;
  if (available < r.getFloat("amount")) {
    throw new BadRequestError(
      "Not enough balance: you have " + Math.max(available, 0) + " available" +
        (committed > 0 ? " (" + committed + " already requested)." : "."),
    );
  }
  e.next();
}, "spend_requests");

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

// ── assignments → un-approved: compensate the earn (approval undo) ───────────
// Moving an assignment OUT of approved (parent undo) reverses the reward, so
// the ledger and the assignment status can never drift apart.
onRecordAfterUpdateSuccess((e) => {
  const becameUnapproved =
    e.record.original().getString("status") === "approved" &&
    e.record.getString("status") !== "approved";
  if (becameUnapproved) {
    const chore = e.app.findRecordById("chores", e.record.getString("chore"));
    const tx = new Record(e.app.findCollectionByNameOrId("currency_transactions"));
    tx.set("user", e.record.getString("child"));
    tx.set("amount", -chore.getFloat("reward"));
    tx.set("type", "manual_adjustment");
    tx.set("reason", "Reversal: " + chore.getString("name"));
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
