// Same server-local wall clock as recurring deadlines and quiet hours.
// Blank means unrestricted; windows may cross midnight.
function windowState(household, now) {
  function allowed(at) {
    const weekend = at.getDay() === 0 || at.getDay() === 6;
    const window = household.getString(weekend ? "grant_weekend_window" : "grant_weekday_window");
    if (!window) return true;
    const parts = window.split("-");
    const minute = at.getHours() * 60 + at.getMinutes();
    const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = minutes(parts[0]), end = minutes(parts[1]);
    return start < end ? minute >= start && minute < end : minute >= start || minute < end;
  }
  if (allowed(now)) return { open: true, message: "" };
  const next = new Date(now);
  next.setSeconds(0, 0);
  // Find the next allowed local minute, including weekend transitions and DST.
  for (let i = 0; i < 8 * 24 * 60; i++) {
    next.setTime(next.getTime() + 60000);
    if (allowed(next)) return { open: false, message: "Queued — unlocks " + next.toLocaleString() + " (server time)" };
  }
  return { open: false, message: "Queued — waiting for an allowed delivery window." };
}
function validate(record) {
  for (const field of ["grant_weekday_window", "grant_weekend_window"]) {
    const value = record.getString(field);
    if (value && (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value) ||
        value.slice(0, 5) === value.slice(6))) {
      throw new BadRequestError("Use a delivery window like 15:30-20:00, or leave it blank for all day.");
    }
  }
}
module.exports = { windowState, validate };
