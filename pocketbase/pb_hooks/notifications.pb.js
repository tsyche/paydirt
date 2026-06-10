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

// ── assignment updated → status changes, kid replies, reactions, swaps ───────
onRecordAfterUpdateSuccess((e) => {
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  const name = chore.getString("name");
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");

  // Kid replied to a rejection (status usually unchanged).
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

  // Parent reacted to an approved chore.
  const reaction = e.record.getString("reaction");
  if (reaction && reaction !== e.record.original().getString("reaction")) {
    notifyUser(e.app, e.record.getString("child"), reaction + " from Mom/Dad", name);
  }

  // Swap offered to a sibling (the target gets pinged).
  const swapTo = e.record.getString("swap_to");
  if (swapTo && swapTo !== e.record.original().getString("swap_to")) {
    const owner = e.app.findRecordById("users", e.record.getString("child"));
    notifyUser(
      e.app,
      swapTo,
      "Swap offer 🔄",
      owner.getString("display_name") + " wants you to take '" + name + "'",
    );
  }

  if (status === prev) {
    e.next();
    return;
  }

  if (status === "completed" && prev !== "approved") {
    // prev === "approved" means a parent undid an approval — they already
    // know it's back in the queue, so don't ping them.
    notifyParents(e.app, chore.getString("household"), "Chore needs approval", name);
  } else if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Chore approved", name + " — nice work!");
  } else if (status === "rejected") {
    const msg = e.record.getString("rejection_message");
    notifyUser(e.app, e.record.getString("child"), "Chore rejected", msg ? name + ": " + msg : name);
  }
  // "closed" (race lost) is announced by races.pb.js with the winner's name.
  e.next();
}, "assignments");

// ── chore proposal created → notify parents ──────────────────────────────────
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

// ── chore proposal resolved → notify the kid ─────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const status = e.record.getString("status");
  if (status === e.record.original().getString("status")) {
    e.next();
    return;
  }
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const name = e.record.getString("name");
  if (status === "approved") {
    notifyUser(e.app, e.record.getString("child"), "Chore idea approved! 🎉", name + " — it's on your list");
  } else if (status === "declined") {
    notifyUser(e.app, e.record.getString("child"), "Chore idea declined", name);
  }
  e.next();
}, "chore_proposals");

// ── broadcast created → fan out to every kid in the household ────────────────
onRecordAfterCreateSuccess((e) => {
  const { notifyChildren } = require(`${__hooks}/lib/ntfy.js`);
  const sender = e.app.findRecordById("users", e.record.getString("sender"));
  notifyChildren(
    e.app,
    e.record.getString("household"),
    "Message from " + sender.getString("display_name"),
    e.record.getString("message"),
  );
  e.next();
}, "broadcasts");

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
