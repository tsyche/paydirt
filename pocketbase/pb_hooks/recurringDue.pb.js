/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  const { nextDue } = require(__hooks + "/lib/recurringDue.js");
  const calendar = require(__hooks + "/lib/calendar.js");
  const household = e.app.findRecordById("households", chore.getString("household"));
  const due = nextDue(chore, calendar.wall(household, new Date()));
  e.record.set("due_at", due ? calendar.instant(household, new Date(due)).toISOString() : "");
  e.next();
}, "assignments");

onRecordUpdateRequest((e) => {
  if (e.record.getString("due_at") !== e.record.original().getString("due_at")) {
    throw new ForbiddenError("Assignment deadlines are server-owned.");
  }
  e.next();
}, "assignments");
