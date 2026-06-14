/// <reference path="../pb_data/types.d.ts" />

// Push notifications.
//
// Kids receive event-driven push via UnifiedPush (ntfy distributor).
// The endpoint URL lives in users.up_endpoint, set by the mobile app on login.
// If a kid has no endpoint yet, notifyUser falls back to their ntfy_topic.
//
// Parents use ntfy directly (they aren't running the mobile app as a kid).

// ── Assignment created → notify the assigned kid ─────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  notifyUser(
    e.app,
    e.record.getString("child"),
    "New chore! ⭐",
    chore.getString("name"),
  );
  e.next();
}, "assignments");

// ── Assignment updated ────────────────────────────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  const name = chore.getString("name");
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");

  // Kid replied to a rejection — ping parents.
  const response = e.record.getString("kid_response");
  if (response && response !== e.record.original().getString("kid_response")) {
    const kid = e.app.findRecordById("users", e.record.getString("child"));
    notifyParents(
      e.app,
      chore.getString("household"),
      kid.getString("display_name") + " replied 💬",
      name + ": " + response,
    );
  }

  if (status === prev) {
    e.next();
    return;
  }

  if (status === "completed" && prev !== "approved") {
    // Chore submitted — parents need to approve.
    notifyParents(e.app, chore.getString("household"), "Chore needs approval", name);
  } else if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Chore approved! ✅", name + " — nice work!");
  } else if (status === "rejected") {
    const msg = e.record.getString("rejection_message");
    notifyUser(
      e.app,
      e.record.getString("child"),
      "Chore needs a redo",
      msg ? name + ": " + msg : name,
    );
  }

  e.next();
}, "assignments");

// ── Chore proposal created → notify parents ───────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const kid = e.app.findRecordById("users", e.record.getString("child"));
  notifyParents(
    e.app,
    e.record.getString("household"),
    "Chore idea from " + kid.getString("display_name") + " 💡",
    e.record.getString("name") + " for " + e.record.getFloat("reward_requested"),
  );
  e.next();
}, "chore_proposals");

// ── Chore proposal resolved → notify kid ─────────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (prev !== "pending" || (status !== "approved" && status !== "declined")) {
    e.next();
    return;
  }
  const name = e.record.getString("name");
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Chore idea approved! 🎉", name + " — it's on your list");
  } else {
    notifyUser(e.app, e.record.getString("child"), "Chore idea declined", name);
  }
  e.next();
}, "chore_proposals");

// ── Broadcast created → notify all kids ──────────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyChildren } = require(`${__hooks}/lib/ntfy.js`);
  notifyChildren(
    e.app,
    e.record.getString("household"),
    "Message from Mom/Dad 📣",
    e.record.getString("message"),
  );
  e.next();
}, "broadcasts");

// ── Spend request created → notify parents ────────────────────────────────────
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

// ── Spend request resolved → notify kid ──────────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (prev !== "pending" || (status !== "approved" && status !== "denied")) {
    e.next();
    return;
  }
  const desc = e.record.getString("description");
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Spend approved! 🎉", desc);
  } else {
    notifyUser(e.app, e.record.getString("child"), "Spend denied", desc);
  }
  e.next();
}, "spend_requests");
