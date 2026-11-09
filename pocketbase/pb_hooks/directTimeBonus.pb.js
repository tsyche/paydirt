/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  const r = e.record;
  if (!e.auth || e.auth.getString("role") !== "parent") throw new ForbiddenError("Only parents can give bonus time.");
  const child = e.app.findRecordById("users", r.getString("child"));
  if (child.getString("role") !== "child" || child.getString("household") !== e.auth.getString("household")) {
    throw new ForbiddenError("Choose a child in your household.");
  }
  const minutes = r.getFloat("minutes");
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120 || minutes % 5 !== 0) {
    throw new BadRequestError("Bonus time must be 5–120 minutes in five-minute steps.");
  }
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(r.getString("request_key"))) throw new BadRequestError("A request key is required.");
  const reason = r.getString("description").trim();
  if (reason.length > 500) throw new BadRequestError("Reason must be 500 characters or fewer.");
  r.set("assignment", "");
  r.set("redemption", "");
  r.set("grant_dispatch_started", false);
  r.set("given_by", e.auth.id);
  r.set("description", reason || "Parent bonus time");
  require(__hooks + "/lib/familylink.js").prepare(r, e.app);
  e.next();
}, "time_grants");

onRecordAfterCreateSuccess((e) => {
  const fl = require(__hooks + "/lib/familylink.js");
  if (e.record.getString("grant_status") === "queued") {
    try { fl.publish(e.app, e.record); } catch (_) {
      e.app.logger().error("Bonus time publication deferred to cron", "grant", e.record.id);
    }
  } else fl.notifyManual(e.app, e.record);
  if (!e.record.getString("redemption") && !e.record.getString("assignment")) require(__hooks + "/lib/ntfy.js").notifyUser(e.app, e.record.getString("child"),
    "Bonus time! 📱", e.record.getInt("minutes") + " minutes: " + e.record.getString("description"), "time_bonus");
  e.next();
}, "time_grants");
