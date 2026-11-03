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
  if (r.getString("status") === "completed" && before.getString("status") === "assigned" &&
      before.getInt("timer_minutes") > 0) {
    const start = before.getString("timer_started_at");
    if (!start || Date.now() < new Date(start.replace(" ", "T")).getTime() + before.getInt("timer_minutes") * 60000) {
      throw new BadRequestError("Finish the timer before marking this chore done.");
    }
  }
  e.next();
}, "assignments");
