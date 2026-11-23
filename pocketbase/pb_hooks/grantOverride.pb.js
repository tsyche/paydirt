/// <reference path="../pb_data/types.d.ts" />
// Only the parent action below may override a grant's delivery window.
onRecordCreateRequest((e) => {
  e.record.set("grant_window_override", false);
  e.next();
}, "time_grants", "spend_requests");
onRecordUpdateRequest((e) => {
  if (e.record.getBool("grant_window_override") !== e.record.original().getBool("grant_window_override")) {
    throw new ForbiddenError("Use the parent Deliver now action to override delivery hours.");
  }
  e.next();
}, "time_grants", "spend_requests");

routerAdd("POST", "/api/paydirt/grants/{collection}/{id}/deliver-now", (e) => {
  if (e.auth.getString("role") !== "parent") throw new ForbiddenError("Only a parent can override delivery hours.");
  const collection = e.request.pathValue("collection");
  if (["time_grants", "spend_requests"].indexOf(collection) === -1) throw new ApiError(404, "Unknown grant type.");
  const id = e.request.pathValue("id");
  e.app.runInTransaction((tx) => {
    const grant = tx.findRecordById(collection, id);
    const child = tx.findRecordById("users", grant.getString("child"));
    if (child.getString("household") !== e.auth.getString("household")) throw new ForbiddenError("This grant belongs to another household.");
    if (collection === "spend_requests" && grant.getString("status") !== "approved") {
      throw new BadRequestError("The purchase must be approved first.");
    }
    // A repeated accepted action never replays delivered or uncertain time.
    if (grant.getBool("grant_window_override")) return;
    if (grant.getString("grant_status") !== "queued") {
      throw new BadRequestError("Only queued, approved time can be delivered now. Refresh or review manual delivery.");
    }
    if (!grant.getBool("grant_window_override")) {
      grant.set("grant_window_override", true);
      grant.set("grant_error", "Parent delivery override enabled.");
      tx.save(grant);
    }
  });
  // Persist intent before publishing. A failed file write is repaired by cron.
  const grant = e.app.findRecordById(collection, id);
  try { require(__hooks + "/lib/familylink.js").publish(e.app, grant); }
  catch (_) { e.app.logger().error("Delivery override publish deferred", "grant", id); }
  return e.json(200, { id });
}, $apis.requireAuth());

// Read-only delivery window for one kid, so clients show the same rules the server enforces.
routerAdd("GET", "/api/paydirt/grants/window/{kid}", (e) => {
  const kid = e.app.findRecordById("users", e.request.pathValue("kid"));
  const self = e.auth.id === kid.id;
  if (!self && !(e.auth.getString("role") === "parent" && e.auth.getString("household") === kid.getString("household"))) {
    throw new ForbiddenError("This kid belongs to another household.");
  }
  const household = e.app.findRecordById("households", kid.getString("household"));
  const windows = require(__hooks + "/lib/grantWindows.js");
  const now = new Date();
  const state = windows.windowState(household, now, kid);
  return e.json(200, {
    open: state.open,
    window: windows.todayWindow(household, now, kid),
    next: state.open ? "" : state.message,
    validUntil: state.validUntil || "",
  });
}, $apis.requireAuth());
