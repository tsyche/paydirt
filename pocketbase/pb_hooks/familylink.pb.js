/// <reference path="../pb_data/types.d.ts" />

// Grant state is server-owned, except a parent's explicit manual completion.
onRecordCreateRequest((e) => {
  e.record.set("grant_status", "");
  e.record.set("grant_error", "");
  e.record.set("grant_delivered_seconds", 0);
  e.next();
}, "spend_requests");

onRecordUpdateRequest((e) => {
  const r = e.record;
  const prev = r.original();
  for (const field of ["child", "amount", "screen_minutes", "description"]) {
    if (r.getString(field) !== prev.getString(field)) {
      throw new BadRequestError("Spend request details cannot change after submission.");
    }
  }
  if (prev.getString("status") !== "pending" && r.getString("status") !== prev.getString("status")) {
    throw new BadRequestError("This spend request is already settled.");
  }
  const manualDone = prev.getString("grant_status") === "manual" &&
    r.getString("grant_status") === "manual_done";
  if (
    (r.getString("grant_status") !== prev.getString("grant_status") && !manualDone) ||
    r.getString("grant_error") !== prev.getString("grant_error") ||
    r.getInt("grant_delivered_seconds") !== prev.getInt("grant_delivered_seconds")
  ) {
    throw new ForbiddenError("Grant results are maintained by the server.");
  }
  if (manualDone) r.set("grant_error", "");
  e.next();
}, "spend_requests");

onRecordDeleteRequest((e) => {
  if (e.record.getString("grant_status") === "queued") {
    throw new BadRequestError("Wait for the screen-time grant result before deleting this request.");
  }
  e.next();
}, "spend_requests");

onRecordUpdate((e) => {
  if (e.record.getString("status") === "approved" && e.record.original().getString("status") === "pending") {
    require(__hooks + "/lib/familylink.js").prepare(e.record, e.app);
  }
  e.next();
}, "spend_requests");

onRecordAfterUpdateSuccess((e) => {
  if (e.record.getString("status") === "approved" && e.record.original().getString("status") === "pending") {
    const fl = require(__hooks + "/lib/familylink.js");
    if (e.record.getString("grant_status") === "queued") {
      try { fl.publish(e.app, e.record); } catch (_) {
        e.app.logger().error("Family Link publish deferred to cron", "spend", e.record.id);
      }
    } else if (e.record.getString("grant_status") === "manual") {
      fl.notifyManual(e.app, e.record);
    }
  }
  e.next();
}, "spend_requests");

cronAdd("paydirt_familylink", "* * * * *", () => {
  require(__hooks + "/lib/familylink.js").reconcile($app);
});

// Chore bonus grants are created only by the approval hook (no create rule).
// Clients may only confirm a manual grant; everything else is server-owned.
onRecordUpdateRequest((e) => {
  const r = e.record;
  const prev = r.original();
  for (const field of ["child", "assignment", "minutes", "description", "grant_error", "given_by", "request_key", "grant_delivered_seconds"]) {
    if (r.getString(field) !== prev.getString(field)) {
      throw new BadRequestError("Time grant details cannot change.");
    }
  }
  const manualDone = prev.getString("grant_status") === "manual" &&
    r.getString("grant_status") === "manual_done";
  if (r.getString("grant_status") !== prev.getString("grant_status") && !manualDone) {
    throw new ForbiddenError("Grant results are maintained by the server.");
  }
  if (manualDone) r.set("grant_error", "");
  e.next();
}, "time_grants");
