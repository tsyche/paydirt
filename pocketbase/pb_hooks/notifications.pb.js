/// <reference path="../pb_data/types.d.ts" />

// Push notifications.
//
// Every role receives event-driven push via UnifiedPush (ntfy distributor).
// The endpoint URL lives in users.up_endpoint, set by the mobile app on login.
// If a user has no endpoint yet, notifyUser falls back to their ntfy_topic.

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

  // "I need help" flag toggled on → notify parents.
  const needsHelp = e.record.getBool("needs_help");
  const prevHelp = e.record.original().getBool("needs_help");
  if (needsHelp && !prevHelp) {
    const kid = e.app.findRecordById("users", e.record.getString("child"));
    notifyParents(
      e.app,
      chore.getString("household"),
      kid.getString("display_name") + " needs help 🆘",
      name,
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

// ── Broadcast created → notify all kids and the other parents ────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyChildren, notifyUserRecord, logToInbox } = require(`${__hooks}/lib/ntfy.js`);
  const sender = e.record.getString("sender");
  const household = e.record.getString("household");
  const message = e.record.getString("message");
  // The sender keeps a copy so parents can see what they've sent.
  logToInbox(e.app, sender, "You sent a message 📣", message, "broadcast_sent");
  notifyChildren(e.app, household, "Message from Mom/Dad 📣", message, "broadcast");
  // Other parents get the push too; the sender already has the inbox copy.
  const parents = e.app.findRecordsByFilter(
    "users",
    "household = {:hh} && role = 'parent' && id != {:sender}",
    "",
    0,
    0,
    { hh: household, sender: sender },
  );
  for (const p of parents) {
    notifyUserRecord(e.app, p, "Message sent to the kids 📣", message, "broadcast");
  }
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

// ── Spend request resolved → notify kid + trigger Phase 2 automation ─────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (prev !== "pending" || (status !== "approved" && status !== "denied")) {
    e.next();
    return;
  }
  const desc = e.record.getString("description");
  const child = e.app.findRecordById("users", e.record.getString("child"));
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Spend approved! 🎉", desc);
    // The server queue owns screen-time grants. Do not also trigger the
    // shelved Android accessibility automation for these approvals.
    notifyParents(e.app, child.getString("household"), "Spend approved", desc);
  } else {
    notifyUser(e.app, e.record.getString("child"), "Spend denied", desc);
  }
  e.next();
}, "spend_requests");

// ── Test notification → push to the caller's own device ──────────────────────
// Lets the setup dialog prove delivery end to end. Bypasses quiet hours (a test
// that silently does nothing is worse than useless) and reports whether the user
// has an endpoint at all.
routerAdd(
  "POST",
  "/api/paydirt/notify-test",
  (e) => {
    const { logToInbox, sendViaEndpoint, sendNtfy } = require(`${__hooks}/lib/ntfy.js`);
    const user = e.auth;
    const title = "PayDirt test 🔔";
    const message = "If you see this, notifications work on this device.";
    logToInbox(e.app, user.id, title, message, "test");
    const endpoint = user.getString("up_endpoint");
    if (endpoint) sendViaEndpoint(e.app, endpoint, title, message);
    else sendNtfy(e.app, user.getString("ntfy_topic"), title, message);
    return e.json(200, { sent: !!(endpoint || user.getString("ntfy_topic")), via: endpoint ? "up" : "topic" });
  },
  $apis.requireAuth("users"),
);
