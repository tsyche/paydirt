// The caller supplies a household wall-clock proxy and converts the result
// back to an instant using lib/calendar.js.
// Date setters preserve wall-clock time through daylight-saving transitions.
function nextDue(chore, now) {
  const time = chore.getString("due_time");
  if (chore.getString("type") !== "recurring" || !time) return "";
  const parts = time.split(":").map(Number);
  const day = chore.getInt("due_day");
  const cadence = chore.getString("cadence");
  const due = new Date(now);
  due.setHours(parts[0], parts[1], 0, 0);
  if (cadence === "daily") {
    if (due <= now) due.setDate(due.getDate() + 1);
  } else if (cadence === "weekly") {
    due.setDate(due.getDate() + (day - due.getDay() + 7) % 7);
    if (due <= now) due.setDate(due.getDate() + 7);
  } else if (cadence === "monthly") {
    const month = due.getMonth();
    due.setDate(1);
    due.setDate(Math.min(day, new Date(due.getFullYear(), month + 1, 0).getDate()));
    if (due <= now) {
      due.setDate(1);
      due.setMonth(month + 1);
      due.setDate(Math.min(day, new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()));
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
