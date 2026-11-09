/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/paydirt/time-bank/redeem", (e) => {
  if (e.auth.getString("role") !== "child") throw new ForbiddenError("Only kids can use their saved time.");
  const body = e.requestInfo().body;
  let id;
  e.app.runInTransaction((tx) => {
    id = require(__hooks + "/lib/timeBank.js").redeem(tx, e.auth.id, body.minutes, body.request_key, body.allow_queue === true).id;
  });
  return e.json(200, { id });
}, $apis.requireAuth());

routerAdd("POST", "/api/paydirt/time-bank/cancel/{id}", (e) => {
  if (e.auth.getString("role") !== "child") throw new ForbiddenError("Only kids can cancel their saved-time reservation.");
  e.app.runInTransaction((tx) => {
    const redemption = tx.findRecordById("time_redemptions", e.request.pathValue("id"));
    if (redemption.getString("child") !== e.auth.id) throw new ForbiddenError("This is not your saved time.");
    if (redemption.getBool("cancelled")) return;
    const grant = tx.findFirstRecordByData("time_grants", "redemption", redemption.id);
    // No job was ever published. Manual tasks are already visible to parents,
    // who may have started an external grant; they are not safe to release.
    if (grant.getString("grant_status") !== "queued" || grant.getBool("grant_dispatch_started") || grant.getInt("grant_delivered_seconds")) {
      throw new BadRequestError("Delivery may have started. Ask a parent to review it.");
    }
    grant.set("grant_status", "cancelled"); tx.save(grant);
    redemption.set("cancelled", true); tx.save(redemption);
    require(__hooks + "/lib/timeBank.js").entry(tx, e.auth.id, "release", redemption.getInt("minutes"), "release:" + redemption.id, "", redemption.id);
  });
  return e.json(200, {});
}, $apis.requireAuth());

// Delivery receipts append immutable history. The reservation already removed
// these minutes from available funds; delivery must not deduct them again.
onRecordUpdate((e) => {
  const redemption = e.record.getString("redemption");
  if (!redemption) { e.next(); return; }
  const before = e.record.original().getInt("grant_delivered_seconds");
  const after = e.record.getInt("grant_delivered_seconds");
  const manual = e.record.getString("grant_status") === "manual_done" && e.record.original().getString("grant_status") !== "manual_done";
  const app = e.app;
  app.runInTransaction((tx) => {
    const current = tx.findRecordById("time_grants", e.record.id);
    if (current.getString("grant_status") !== e.record.original().getString("grant_status") || current.getInt("grant_delivered_seconds") !== before || current.getBool("grant_dispatch_started") !== e.record.original().getBool("grant_dispatch_started")) {
      throw new BadRequestError("This delivery changed. Refresh before trying again.");
    }
    e.app = tx;
    try {
      e.next();
      const minutes = manual ? e.record.getInt("minutes") - before / 60 : (after - before) / 60;
      if (minutes > 0) require(__hooks + "/lib/timeBank.js").entry(tx, e.record.getString("child"), "redeem", minutes,
        "delivered:" + e.record.id + ":" + (manual ? "manual" : after), "", redemption);
    } finally { e.app = app; }
  });
}, "time_grants");

onRecordUpdateRequest((e) => {
  if (e.record.getString("time_choice") !== e.record.original().getString("time_choice")) {
    if (e.auth.id !== e.record.getString("child") || e.record.original().getString("status") === "completed" || e.record.original().getString("status") === "approved") {
      throw new ForbiddenError("Choose Bank or Use now before submitting your chore.");
    }
  }
  e.next();
}, "assignments");

onRecordCreateRequest((e) => {
  e.record.set("time_choice", "bank");
  e.next();
}, "assignments");
