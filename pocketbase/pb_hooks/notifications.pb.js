/// <reference path="../pb_data/types.d.ts" />

// Push notifications.
//
// Every role receives event-driven push via UnifiedPush (ntfy distributor).
// The endpoint URL lives in users.up_endpoint, set by the mobile app on login.
// If a user has no endpoint yet, notifyUser falls back to their ntfy_topic.

// ── Assignment created → notify the assigned kid ─────────────────────────────
// The recurring auto-assignment cron flags its records so the kid's daily chore
// summary (scheduler.js runTick) is the only push for them.
onRecordAfterCreateSuccess((e) => {
  if (e.record.getBool("auto_created")) {
    e.next();
    return;
  }
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  notifyUser(
    e.app,
    e.record.getString("child"),
    "New chore! ⭐",
    chore.getString("name"),
    "chore_assigned", "assignments:" + e.record.id,
  );
  e.next();
}, "assignments");

// ── Assignment updated ────────────────────────────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser, notifyParents, clearSource } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  const name = chore.getString("name");
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  const source = "assignments:" + e.record.id;
  if (status !== prev) {
    clearSource(e.app, source);
    clearSource(e.app, source + ":help");
  }
  if (!e.record.getBool("needs_help") && e.record.original().getBool("needs_help")) {
    clearSource(e.app, source + ":help");
  }

  // Kid replied to a rejection — ping parents.
  const response = e.record.getString("kid_response");
  if (response && response !== e.record.original().getString("kid_response")) {
    const kid = e.app.findRecordById("users", e.record.getString("child"));
    notifyParents(
      e.app,
      chore.getString("household"),
      kid.getString("display_name") + " replied 💬",
      name + ": " + response,
      "chore_reply", source,
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
      "chore_help", source + ":help",
    );
  }

  if (status === prev) {
    e.next();
    return;
  }

  if (status === "completed" && prev !== "approved") {
    // Chore submitted — parents need to approve.
    notifyParents(e.app, chore.getString("household"), "Chore needs approval", name, "chore_completed", source);
  } else if (status === "approved") {
    const percent = e.record.getFloat("credit_percent") || 100;
    const feedback = e.record.getString("approval_comment");
    notifyUser(e.app, e.record.getString("child"), "Chore approved! ✅",
      name + (percent < 100 ? " — " + percent + "% credit, nice effort!" : " — nice work!") +
      (feedback ? "\nParent feedback: " + feedback : ""));
  } else if (status === "rejected") {
    const msg = e.record.getString("rejection_message");
    notifyUser(
      e.app,
      e.record.getString("child"),
      "Chore needs a redo",
      msg ? name + ": " + msg : name,
      "chore_rejected", source,
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
    "chore_proposed", "chore_proposals:" + e.record.id,
  );
  e.next();
}, "chore_proposals");

// ── Chore proposal resolved → notify kid ─────────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser, clearSource } = require(`${__hooks}/lib/ntfy.js`);
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (prev !== "pending" || (status !== "approved" && status !== "declined")) {
    e.next();
    return;
  }
  clearSource(e.app, "chore_proposals:" + e.record.id);
  const name = e.record.getString("name");
  const reason = e.record.getString("decline_reason");
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Chore idea approved! 🎉", name + " — it's on your list");
  } else {
    notifyUser(e.app, e.record.getString("child"), "Chore idea declined", reason ? `${name} — ${reason}` : name);
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
  notifyChildren(e.app, household, "Message from Mom/Dad 📣", message, "broadcast", "broadcasts:" + e.record.id);
  const senderName = e.app.findRecordById("users", sender).getString("display_name") || "A parent";
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
    notifyUserRecord(e.app, p, senderName + " messaged the kids 📣", message, "broadcast");
  }
  e.next();
}, "broadcasts");

// ── Kid replies to a broadcast → notify parents ──────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyParents, clearSource } = require(`${__hooks}/lib/ntfy.js`);
  const labels = { ok: "👍 OK", question: "❓ Question", later: "⏰ Later", please: "🙏 Please" };
  clearSource(e.app, "broadcasts:" + e.record.getString("broadcast"), e.record.getString("child"));
  const kid = e.app.findRecordById("users", e.record.getString("child"));
  const broadcast = e.app.findRecordById("broadcasts", e.record.getString("broadcast"));
  const code = e.record.getString("code");
  notifyParents(
    e.app,
    broadcast.getString("household"),
    kid.getString("display_name") + " replied " + (labels[code] || code),
    "re: " + broadcast.getString("message"),
    "broadcast_reply",
  );
  e.next();
}, "broadcast_replies");

// ── Spend request created → notify parents ────────────────────────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const child = e.app.findRecordById("users", e.record.getString("child"));
  notifyParents(
    e.app,
    child.getString("household"),
    "Spend request",
    child.getString("display_name") + ": " + e.record.getString("description"),
    "spend_requested", "spend_requests:" + e.record.id,
  );
  e.next();
}, "spend_requests");

// ── Spend request resolved → notify kid + trigger Phase 2 automation ─────────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser, notifyParents, clearSource } = require(`${__hooks}/lib/ntfy.js`);
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");
  if (prev !== "pending" || (status !== "approved" && status !== "denied")) {
    e.next();
    return;
  }
  clearSource(e.app, "spend_requests:" + e.record.id);
  const desc = e.record.getString("description");
  const reason = e.record.getString("decline_reason");
  const child = e.app.findRecordById("users", e.record.getString("child"));
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Spend approved! 🎉", desc);
    // The server queue owns screen-time grants. Do not also trigger the
    // shelved Android accessibility automation for these approvals.
    // Do not replace the deciding parent's cleared request with another alert
    // about the action they just took. Other parents still get the update.
    const others = e.app.findRecordsByFilter("users",
      "household = {:hh} && role = 'parent' && id != {:resolver}", "", 0, 0,
      { hh: child.getString("household"), resolver: e.record.getString("resolved_by") });
    for (const parent of others) notifyUser(e.app, parent.id, "Spend approved", desc);
  } else {
    notifyUser(e.app, e.record.getString("child"), "Spend denied", reason ? `${desc} — ${reason}` : desc);
  }
  e.next();
}, "spend_requests");

// Deleting an action target also removes its now-useless reminders.
onRecordAfterDeleteSuccess((e) => {
  const { clearSource } = require(`${__hooks}/lib/ntfy.js`);
  const source = e.record.collection().name + ":" + e.record.id;
  clearSource(e.app, source);
  clearSource(e.app, source + ":help");
  clearSource(e.app, source + ":grant");
  e.next();
}, "assignments", "chore_proposals", "spend_requests", "time_grants", "broadcasts");

onRecordAfterUpdateSuccess((e) => {
  if (e.record.getString("grant_status") === "manual_done" &&
      e.record.original().getString("grant_status") === "manual") {
    require(`${__hooks}/lib/ntfy.js`).clearSource(e.app, e.record.collection().name + ":" + e.record.id + ":grant");
  }
  e.next();
}, "spend_requests", "time_grants");

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
