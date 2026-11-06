// The caller supplies calendar.wallUtc and converts with calendar.instantUtc.
// UTC field arithmetic keeps host DST rules out of the household wall clock.
function nextDue(chore, now) {
  const time = chore.getString("due_time");
  if (chore.getString("type") !== "recurring" || !time) return "";
  const parts = time.split(":").map(Number);
  const day = chore.getInt("due_day");
  const cadence = chore.getString("cadence");
  const due = new Date(now);
  due.setUTCHours(parts[0], parts[1], 0, 0);
  if (cadence === "daily") {
    if (due <= now) due.setUTCDate(due.getUTCDate() + 1);
  } else if (cadence === "weekly") {
    due.setUTCDate(due.getUTCDate() + (day - due.getUTCDay() + 7) % 7);
    if (due <= now) due.setUTCDate(due.getUTCDate() + 7);
  } else if (cadence === "monthly") {
    const month = due.getUTCMonth();
    due.setUTCDate(1);
    due.setUTCDate(Math.min(day, new Date(Date.UTC(due.getUTCFullYear(), month + 1, 0)).getUTCDate()));
    if (due <= now) {
      due.setUTCDate(1);
      due.setUTCMonth(month + 1);
      due.setUTCDate(Math.min(day, new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate()));
    }
  } else return "";
  return due.toISOString();
}

function validate(record) {
  if (!record.getString("due_time")) return;
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(record.getString("due_time"))) {
    throw new BadRequestError("Due time must use HH:MM (24-hour time).");
  }
  const cadence = record.getString("cadence");
  const day = record.getInt("due_day");
  if (record.getString("type") !== "recurring" ||
      !["daily", "weekly", "monthly"].includes(cadence) ||
      (cadence === "weekly" && (day < 0 || day > 6)) ||
      (cadence === "monthly" && (day < 1 || day > 31))) {
    throw new BadRequestError("Choose a valid recurring due day and time.");
  }
}
module.exports = { nextDue, validate };
