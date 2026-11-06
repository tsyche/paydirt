// Same server-local wall clock as recurring deadlines and quiet hours.
// Blank means unrestricted; windows may cross midnight.
function windowState(household, now, child) {
  const zone = household.getString("grant_timezone") || "America/Los_Angeles";
  const fields = ["grant_weekday_window", "grant_weekend_window"];
  if (!household.getString("grant_day_windows") && !(child && child.getString("grant_day_windows")) && fields.every((field) => {
    const value = child ? child.getString(field) : "";
    return value === "all" || !(value || household.getString(field));
  })) return { open: true, message: "", validUntil: "" };
  function allowed(at) {
    const local = zone ? new DateTime(at.toISOString()).time().in(new Timezone(zone)) : null;
    const day = local ? Number(local.weekday()) : at.getDay();
    const weekend = day === 0 || day === 6;
    const field = weekend ? "grant_weekend_window" : "grant_weekday_window";
    const householdDays = JSON.parse(household.getString("grant_day_windows") || "{}");
    const childDays = JSON.parse(child ? child.getString("grant_day_windows") || "{}" : "{}");
    const override = childDays[day] || (child ? child.getString(field) : "");
    const window = override || householdDays[day] || household.getString(field);
    if (!window || window === "all") return true;
    if (window === "none") return false;
    const minute = local ? Number(local.format("15")) * 60 + Number(local.format("04")) : at.getHours() * 60 + at.getMinutes();
    const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    return window.split(",").some((range) => {
      const parts = range.trim().split("-");
      const start = minutes(parts[0]), end = minutes(parts[1]);
      return start < end ? minute >= start && minute < end : minute >= start || minute < end;
    });
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
    if (allowed(next)) {
      const local = new DateTime(next.toISOString()).time().in(new Timezone(zone));
      return { open: false, message: "Banked — next delivery " + local.format("Mon, Jan 2 at 3:04 PM MST") };
    }
  }
  return { open: false, message: "Banked — waiting for an allowed delivery window." };
}
function validate(record) {
  let days;
  try {
    days = JSON.parse(record.getString("grant_day_windows") || "{}");
    if (!days || Array.isArray(days) || typeof days !== "object" ||
        Object.keys(days).some((key) => !/^[0-6]$/.test(key) || typeof days[key] !== "string" || !days[key])) throw new Error();
  } catch (_) { throw new BadRequestError("Choose valid delivery days."); }
  const values = ["grant_weekday_window", "grant_weekend_window"].map((field) => record.getString(field)).concat(Object.values(days));
  for (const value of values) {
    if (value === "all" || value === "none") continue;
    const occupied = new Set();
    for (const range of value ? value.split(",").map((part) => part.trim()) : []) {
      if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(range) || range.slice(0, 5) === range.slice(6)) {
        throw new BadRequestError("Choose a start and end for every delivery window.");
      }
      const minute = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      const start = minute(range.slice(0, 5)), end = minute(range.slice(6));
      for (let at = start; at !== end; at = (at + 1) % 1440) {
        if (occupied.has(at)) throw new BadRequestError("Delivery windows cannot overlap.");
        occupied.add(at);
      }
    }
  }
  const zone = record.getString("grant_timezone");
  if (zone) { try { new Timezone(zone); } catch (_) { throw new BadRequestError("Choose a valid timezone, such as America/Los_Angeles."); } }
}
module.exports = { windowState, validate };
