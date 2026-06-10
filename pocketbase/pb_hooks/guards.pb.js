/// <reference path="../pb_data/types.d.ts" />

// Authorization guards that the declarative collection rules can't express
// (they depend on the *value* a field is changing to, not just who's asking).
// onRecordUpdateRequest fires only for API requests, so internal hook saves
// (e.app.save) are never blocked by these.

// Only a parent may move an assignment to approved/rejected. The update rule
// lets a child PATCH their own assignment (to mark it completed); this stops
// them from self-approving.
onRecordUpdateRequest((e) => {
  const status = e.record.getString("status");
  if (status === "approved" || status === "rejected") {
    if (!e.auth || e.auth.getString("role") !== "parent") {
      throw new ForbiddenError("Only a parent can approve or reject a chore.");
    }
  }
  e.next();
}, "assignments");

// If a chore requires a photo, block completion without one.
// Runs during the update lifecycle (after new values are applied, before save).
onRecordUpdate((e) => {
  const newStatus = e.record.getString("status");
  const prevStatus = e.record.original().getString("status");
  if (newStatus === "completed" && prevStatus !== "completed") {
    const chore = e.app.findRecordById("chores", e.record.getString("chore"));
    if (chore.getBool("photo_required") && !e.record.getString("photo")) {
      throw new ApiError(400, "This chore requires a photo — snap one first.");
    }
  }
  e.next();
}, "assignments");
