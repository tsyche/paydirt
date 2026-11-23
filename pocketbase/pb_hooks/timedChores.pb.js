/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  e.record.set("timer_minutes", chore.getInt("timer_minutes"));
  e.record.set("timer_started_at", "");
  e.next();
}, "assignments");

onRecordUpdateRequest((e) => {
  const r = e.record;
  const before = r.original();
  if (r.getFloat("timer_minutes") !== before.getFloat("timer_minutes")) {
    throw new ForbiddenError("Timer duration is server-owned.");
  }
  if (r.getString("timer_started_at") !== before.getString("timer_started_at")) {
    if (!e.auth || e.auth.id !== before.getString("child") ||
        before.getString("status") !== "assigned" || before.getString("timer_started_at") ||
        !r.getString("timer_started_at") || before.getInt("timer_minutes") <= 0 ||
        r.getString("child") !== before.getString("child")) {
      throw new ForbiddenError("Only the assigned kid can start this timer once.");
    }
    r.set("timer_started_at", new Date().toISOString());
  }
  // A swap never transfers time already logged by a sibling.
  if (r.getString("child") !== before.getString("child")) r.set("timer_started_at", "");
  const submitting = r.getString("status") === "completed" &&
    ["assigned", "rejected"].indexOf(before.getString("status")) !== -1;
  if (before.getInt("timer_minutes") > 0) {
    if (submitting) {
      const now = new Date();
      const start = before.getString("timer_started_at");
      const finished = start && now.getTime() >= new Date(start.replace(" ", "T")).getTime() + before.getInt("timer_minutes") * 60000;
      if (!finished && !r.getString("submission_note").trim()) {
        throw new BadRequestError("Timer not used or incomplete. Add a short explanation of what you did so a parent can review it.");
      }
      // Never let the device's clock turn an incomplete timer into completed proof.
      r.set("completed_at", now.toISOString());
    } else if (r.getString("completed_at") !== before.getString("completed_at")) {
      throw new ForbiddenError("The timer submission time is server-owned.");
    }
  }
  e.next();
}, "assignments");
