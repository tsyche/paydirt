/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  const { nextDue } = require(__hooks + "/lib/recurringDue.js");
  e.record.set("due_at", nextDue(chore, new Date()));
  e.next();
}, "assignments");

onRecordUpdateRequest((e) => {
  if (e.record.getString("due_at") !== e.record.original().getString("due_at")) {
    throw new ForbiddenError("Assignment deadlines are server-owned.");
  }
  e.next();
}, "assignments");
