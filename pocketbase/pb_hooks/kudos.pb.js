/// <reference path="../pb_data/types.d.ts" />

// Parent "Great work" awards. The record is immutable once created, except
// that its own child may acknowledge the one-time celebration. The ledger
// credit is created here rather than by either client, so balance changes stay
// auditable and use a distinct transaction type.

onRecordCreateRequest((e) => {
  const auth = e.auth;
  if (!auth || auth.getString("role") !== "parent") {
    throw new ForbiddenError("Only a parent can give kudos.");
  }

  const child = e.app.findRecordById("users", e.record.getString("child"));
  if (
    child.getString("role") !== "child" ||
    child.getString("household") !== auth.getString("household")
  ) {
    throw new BadRequestError("Kudos must go to a child in your household.");
  }

  // Never trust household, parent, or acknowledgement values from a client.
  e.record.set("household", auth.getString("household"));
  e.record.set("given_by", auth.id);
  e.record.set("reason", e.record.getString("reason").trim());
  e.record.set("seen_at", "");
  e.next();
}, "kudos");

onRecordUpdateRequest((e) => {
  const auth = e.auth;
  const before = e.record.original();
  if (!auth || auth.id !== before.getString("child")) {
    throw new ForbiddenError("Only the awarded child can acknowledge kudos.");
  }

  for (const name of ["household", "child", "given_by", "reason"]) {
    if (e.record.getString(name) !== before.getString(name)) {
      throw new ForbiddenError("Kudos awards can't be edited.");
    }
  }
  if (e.record.getFloat("bucks") !== before.getFloat("bucks")) {
    throw new ForbiddenError("Kudos awards can't be edited.");
  }
  if (before.getString("seen_at") || !e.record.getString("seen_at")) {
    throw new ForbiddenError("This kudos award was already acknowledged.");
  }

  // Use the server clock rather than a device-supplied timestamp.
  e.record.set("seen_at", new Date().toISOString());
  e.next();
}, "kudos");

onRecordAfterCreateSuccess((e) => {
  const award = e.record;
  const tx = new Record(e.app.findCollectionByNameOrId("currency_transactions"));
  tx.set("user", award.getString("child"));
  tx.set("amount", award.getFloat("bucks"));
  tx.set("type", "kudos");
  tx.set("reason", award.getString("reason") ? "Kudos: " + award.getString("reason") : "Kudos");
  tx.set("related_kudos", award.id);
  e.app.save(tx);

  const child = e.app.findRecordById("users", award.getString("child"));
  const household = e.app.findRecordById("households", award.getString("household"));
  const currency = household.getString("currency_name") || "Grit";
  const reason = award.getString("reason");
  const message =
    "+" + award.getFloat("bucks") + " " + currency + (reason ? ": " + reason : "");
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  notifyUser(e.app, child.id, "⭐ Great work!", message, "kudos");
  e.next();
}, "kudos");
