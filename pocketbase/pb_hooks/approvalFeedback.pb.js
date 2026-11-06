/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  e.record.set("approval_comment", "");
  e.next();
}, "assignments");

// Sibling activity may be visible for the leaderboard; personal feedback is not.
onRecordEnrich((e) => {
  const auth = e.requestInfo && e.requestInfo.auth;
  if (!auth || (auth.getString("role") === "child" && auth.id !== e.record.getString("child"))) {
    e.record.hide("approval_comment");
  }
  e.next();
}, "assignments");

onRecordUpdateRequest((e) => {
  const before = e.record.original();
  const status = e.record.getString("status");
  // Undo must not leave feedback attached to a later, separate approval.
  if (before.getString("status") === "approved" && status !== "approved") {
    e.record.set("approval_comment", "");
    e.next();
    return;
  }
  const comment = e.record.getString("approval_comment").trim();
  e.record.set("approval_comment", comment);
  if (comment !== before.getString("approval_comment")) {
    if (!e.auth || e.auth.getString("role") !== "parent") {
      throw new ForbiddenError("Only a parent can write approval feedback.");
    }
    if (status !== "approved" || before.getString("status") === "approved") {
      throw new BadRequestError("Add feedback when approving the chore.");
    }
  }
  e.next();
}, "assignments");
