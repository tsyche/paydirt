// Same server-local wall clock as recurring deadlines and quiet hours.
// Blank means unrestricted; windows may cross midnight.
function windowState(household, now, child) {
  const zone = household.getString("grant_timezone");
  const fields = ["grant_weekday_window", "grant_weekend_window"];
  if (fields.every((field) => {
    const value = child ? child.getString(field) : "";
    return value === "all" || !(value || household.getString(field));
  })) return { open: true, message: "", validUntil: "" };
  function allowed(at) {
    const local = zone ? new DateTime(at.toISOString()).time().in(new Timezone(zone)) : null;
    const day = local ? Number(local.weekday()) : at.getDay();
    const weekend = day === 0 || day === 6;
    const field = weekend ? "grant_weekend_window" : "grant_weekday_window";
    const override = child ? child.getString(field) : "";
    const window = override === "all" ? "" : override || household.getString(field);
    if (!window) return true;
    const parts = window.split("-");
    const minute = local ? Number(local.format("15")) * 60 + Number(local.format("04")) : at.getHours() * 60 + at.getMinutes();
    const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = minutes(parts[0]), end = minutes(parts[1]);
    return start < end ? minute >= start && minute < end : minute >= start || minute < end;
  }
  if (allowed(now)) {
    const close = new Date(now);
    close.setSeconds(0, 0);
    for (let i = 0; i < 8 * 24 * 60; i++) {
      close.setTime(close.getTime() + 60000);
      if (!allowed(close)) return { open: true, message: "", validUntil: close.toISOString() };
    }
    return { open: true, message: "", validUntil: "" };
  }
  const next = new Date(now);
  next.setSeconds(0, 0);
  // Find the next allowed local minute, including weekend transitions and DST.
  for (let i = 0; i < 8 * 24 * 60; i++) {
    next.setTime(next.getTime() + 60000);
    if (allowed(next)) return { open: false, message: "Queued — unlocks " + next.toISOString() + " (UTC)" };
  }
  return { open: false, message: "Queued — waiting for an allowed delivery window." };
}
function validate(record) {
  for (const field of ["grant_weekday_window", "grant_weekend_window"]) {
    const value = record.getString(field);
    if (record.collection().name === "users" && value === "all") continue;
    if (value && (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value) ||
        value.slice(0, 5) === value.slice(6))) {
      throw new BadRequestError("Use a delivery window like 15:30-20:00, or leave it blank for all day.");
    }
  }
  const zone = record.getString("grant_timezone");
  if (zone) { try { new Timezone(zone); } catch (_) { throw new BadRequestError("Choose a valid timezone, such as America/Los_Angeles."); } }
}
module.exports = { windowState, validate };
