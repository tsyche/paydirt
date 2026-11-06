/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const sources = { inbox: "inbox", kudos: "kudos", assignment: "assignments", spend_request: "spend_requests", time_grant: "time_grants" };
  const selected = Object.keys(sources).filter((field) => e.record.getString(field));
  if (selected.length !== 1) throw new BadRequestError("Choose exactly one item to archive.");
  const field = selected[0];
  const record = e.app.findRecordById(sources[field], e.record.getString(field));
  if (!e.auth || !e.app.canAccessRecord(record, e.requestInfo(), record.collection().viewRule)) {
    throw new ForbiddenError("You cannot archive this item.");
  }
  if (field === "inbox") {
    if (record.getString("user") !== e.auth.id) throw new ForbiddenError("This alert is private.");
  } else {
    if (e.auth.getString("role") !== "parent" && record.getString("child") !== e.auth.id) {
      throw new ForbiddenError("Only archive your own history.");
    }
    if (field === "assignment" && record.getString("status") !== "approved") {
      throw new BadRequestError("Pending chores cannot be archived.");
    }
    if (field === "spend_request" && (record.getString("status") !== "approved" || record.getFloat("screen_minutes") <= 0)) {
      throw new BadRequestError("Only settled screen-time grants can be archived here.");
    }
    if ((field === "spend_request" || field === "time_grant") &&
        ["granted", "manual_done"].indexOf(record.getString("grant_status")) === -1) {
      throw new BadRequestError("Outstanding time grants cannot be archived.");
    }
  }
  e.record.set("user", e.auth.id);
  e.next();
}, "archives");
