/// <reference path="../pb_data/types.d.ts" />

// Push notifications.
//
// Kids receive notifications through the in-app background service
// (apps/mobile/lib/backgroundService.ts), which polls PocketBase directly.
// ntfy is kept only for parent-facing events so the parent gets pinged on
// their phone even when the web dashboard isn't open.

// ── assignment created → (kids learn via background service poll) ─────────────
// No server-side ntfy needed for the child.

// ── assignment updated → status changes, kid replies, reactions, swaps ───────
onRecordAfterUpdateSuccess((e) => {
  const { notifyParents } = require(`${__hooks}/lib/ntfy.js`);
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

  // Chore completed → parents need to approve.
  if (status === "completed" && prev !== "approved") {
    notifyParents(e.app, chore.getString("household"), "Chore needs approval", name);
  }
  // approved / rejected / reaction / swap → kids learn via background service.
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

// ── chore proposal resolved → kids learn via background service ───────────────

// ── broadcast created → parents sent it; kids learn via background service ───

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

// ── spend request resolved → kids learn via background service ────────────────
