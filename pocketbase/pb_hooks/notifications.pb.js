/// <reference path="../pb_data/types.d.ts" />

// ntfy notifications. Each user subscribes to their own ntfy_topic; server comes
// from $NTFY_SERVER (defaults to https://ntfy.sh). Helpers live in lib/ntfy.js
// and must be require()'d INSIDE each handler (isolated-VM rule).

// ── assignment created → notify the child ────────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  notifyUser(e.app, e.record.getString("child"), "New chore assigned", chore.getString("name"));
  e.next();
}, "assignments");

// ── assignment updated → notify on completed / approved / rejected ───────────
onRecordAfterUpdateSuccess((e) => {
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (status === prev) {
    e.next();
    return;
  }
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  const name = chore.getString("name");

  if (status === "completed") {
    notifyParents(e.app, chore.getString("household"), "Chore needs approval", name);
  } else if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Chore approved", name + " — nice work!");
  } else if (status === "rejected") {
    const msg = e.record.getString("rejection_message");
    notifyUser(e.app, e.record.getString("child"), "Chore rejected", msg ? name + ": " + msg : name);
  }
  e.next();
}, "assignments");

// ── spend request created → notify parents ───────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const child = e.app.findRecordById("users", e.record.getString("child"));
  notifyParents(
    e.app,
    child.getString("household"),
    "Spend request",
    child.getString("display_name") + ": " + e.record.getString("description"),
  );
  e.next();
}, "spend_requests");

// ── spend request resolved → notify the child ────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (status === prev) {
    e.next();
    return;
  }
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Spend approved", e.record.getString("description"));
  } else if (status === "denied") {
    notifyUser(e.app, e.record.getString("child"), "Spend denied", e.record.getString("description"));
  }
  e.next();
}, "spend_requests");
