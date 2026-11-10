/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/paydirt/assignments/{id}/messages", (e) => {
  let id;
  const body = e.requestInfo().body;
  e.app.runInTransaction((tx) => {
    id = require(__hooks + "/lib/conversations.js").send(tx, e.auth, e.request.pathValue("id"), body.body, body.request_key).id;
  });
  return e.json(200, { id });
}, $apis.requireAuth());

onRecordCreateRequest((e) => {
  e.record.set("thread_actor", ""); e.record.set("submission_note", ""); e.next();
}, "assignments");

onRecordUpdateRequest((e) => {
  const before = e.record.original();
  e.record.set("thread_actor", e.auth.id);
  const note = e.record.getString("submission_note").trim();
  const submitting = before.getString("status") !== "completed" && e.record.getString("status") === "completed";
  if (note !== before.getString("submission_note") && (!submitting || e.auth.id !== e.record.getString("child"))) throw new ForbiddenError("Add a submission note when marking your chore done.");
  if (note.length > 1000) throw new BadRequestError("Submission notes must be 1,000 characters or fewer.");
  e.record.set("submission_note", submitting ? note : "");
  e.next();
}, "assignments");

onRecordEnrich((e) => {
  e.record.hide("thread_actor");
  const auth = e.requestInfo && e.requestInfo.auth;
  if (!auth || (auth.getString("role") === "child" && auth.id !== e.record.getString("child"))) {
    for (const field of ["submission_note", "rejection_message", "kid_response"]) e.record.hide(field);
  }
  e.next();
}, "assignments");

onRecordUpdate((e) => {
  const before = e.record.original().getString("status"), status = e.record.getString("status");
  const app = e.app;
  app.runInTransaction((tx) => {
    e.app = tx;
    try {
      if (e.record.getString("child") !== e.record.original().getString("child")) {
        // The immutable timeline keeps the old audience's feedback. Never let
        // copied legacy fields expose it to the newly assigned child.
        for (const field of ["approval_comment", "rejection_message", "kid_response", "submission_note"]) e.record.set(field, "");
      }
      e.next();
      let kind = "", body = "";
      if (status !== before) {
        if (status === "completed") { kind = "submitted"; body = e.record.getString("submission_note"); }
        if (status === "approved") { kind = "approved"; body = e.record.getString("approval_comment"); }
        if (status === "rejected") { kind = "rejected"; body = e.record.getString("rejection_message"); }
        if (status === "closed") kind = "closed";
        if (before === "approved" && status !== "approved") kind = "reopened";
      } else if (e.record.getString("kid_response") !== e.record.original().getString("kid_response") && e.record.getString("kid_response")) {
        kind = "message"; body = e.record.getString("kid_response");
      }
      if (kind) {
        let author;
        if (status !== "closed") {
          try { author = tx.findRecordById("users", e.record.getString("thread_actor")); } catch (_) { /* system */ }
        }
        require(__hooks + "/lib/conversations.js").append(tx, e.record, kind, body, author);
      }
    } finally { e.app = app; }
  });
}, "assignments");

onRecordAfterCreateSuccess((e) => {
  if (e.record.getString("kind") === "message" && e.record.getString("request_key")) {
    const assignment = e.app.findRecordById("assignments", e.record.getString("assignment"));
    const chore = e.app.findRecordById("chores", assignment.getString("chore"));
    const notify = require(__hooks + "/lib/ntfy.js").notifyUser;
    const recipients = e.app.findRecordsByFilter("users", "household = {:hh} && role = 'parent'", "", 0, 0, { hh: chore.getString("household") });
    // Do not send a prior child's private messages to a reassigned sibling.
    if (assignment.getString("child") === e.record.getString("child")) recipients.push(e.app.findRecordById("users", e.record.getString("child")));
    for (const user of recipients) {
      if (user.id === e.record.getString("author")) continue;
      notify(e.app, user.id, e.record.getString("author_name") + " sent a chore message", chore.getString("name") + ": " + e.record.getString("body"), "chore_message", "assignments:" + assignment.id + ":conversation");
    }
  }
  e.next();
}, "chore_messages");
