// Held earnings never become delivery rows until explicitly reserved.
function rows(app, child) {
  return app.findRecordsByFilter("time_ledger", "child = {:child}", "created,id", 0, 0, { child });
}
function available(app, child) {
  return rows(app, child).reduce((total, row) => {
    const kind = row.getString("kind");
    return total + (kind === "earn" || kind === "release" ? row.getInt("minutes") : kind === "reserve" ? -row.getInt("minutes") : 0);
  }, 0);
}
function entry(app, child, kind, minutes, key, assignment, redemption) {
  const row = new Record(app.findCollectionByNameOrId("time_ledger"));
  row.set("child", child); row.set("kind", kind); row.set("minutes", minutes);
  row.set("event_key", key); row.set("assignment", assignment || ""); row.set("redemption", redemption || "");
  app.save(row);
}
function redeem(app, child, minutes, key, allowQueue, assignment) {
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 120 || minutes % 15) throw new BadRequestError("Use 15–60 minutes in 15-minute steps.");
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(key)) throw new BadRequestError("A request key is required.");
  // Honor old larger requests on retry; apply the new cap only to new debits.
  const existing = app.findRecordsByFilter("time_redemptions", "child = {:child} && request_key = {:key}", "", 1, 0, { child, key });
  if (existing.length) {
    if (existing[0].getInt("minutes") !== minutes) throw new BadRequestError("This request key was already used for another amount.");
    return existing[0];
  }
  if (minutes > 60) throw new BadRequestError("Use up to 60 minutes at a time in 15-minute steps.");
  if (available(app, child) < minutes) throw new BadRequestError("Not enough saved minutes.");
  const kid = app.findRecordById("users", child);
  const household = app.findRecordById("households", kid.getString("household"));
  if (!allowQueue && !require(__hooks + "/lib/grantWindows.js").windowState(household, new Date(), kid).open) {
    throw new BadRequestError("Outside allowed hours. Confirm queueing for the next allowed window.");
  }
  const redemption = new Record(app.findCollectionByNameOrId("time_redemptions"));
  redemption.set("child", child); redemption.set("minutes", minutes); redemption.set("request_key", key);
  app.save(redemption);
  entry(app, child, "reserve", minutes, "reserve:" + redemption.id, "", redemption.id);
  const grant = new Record(app.findCollectionByNameOrId("time_grants"));
  grant.set("assignment", assignment || "");
  grant.set("child", child); grant.set("minutes", minutes); grant.set("redemption", redemption.id);
  grant.set("description", "Saved chore time: " + minutes + " min");
  require(__hooks + "/lib/familylink.js").prepare(grant, app);
  app.save(grant);
  return redemption;
}
function award(app, assignment) {
  const chore = app.findRecordById("chores", assignment.getString("chore"));
  const pay = require(__hooks + "/lib/chorePay.js").partialPay(chore, assignment.getFloat("credit_percent") || 100);
  if (!pay.minutes) return;
  const child = assignment.getString("child");
  entry(app, child, "earn", pay.minutes, "earn:" + assignment.id, assignment.id);
  // Use now follows the one-hour cap; keep excess and sub-15 remainders saved.
  const now = Math.min(60, Math.floor(pay.minutes / 15) * 15);
  if (assignment.getString("time_choice") === "use" && now) redeem(app, child, now, "assignment_" + assignment.id, true, assignment.id);
}
module.exports = { available, entry, redeem, award };
