// The existing household timezone now governs all wall-clock features.
const DEFAULT_ZONE = "America/Los_Angeles";
function zone(household) { return household.getString("grant_timezone") || DEFAULT_ZONE; }
function day(household, at) {
  return new DateTime(at.toISOString()).time().in(new Timezone(zone(household))).format("2006-01-02");
}
function wall(household, at) {
  return new Date(new DateTime(at.toISOString()).time().in(new Timezone(zone(household))).format("2006-01-02T15:04:05"));
}
function instant(household, wallDate) {
  const pad = (n) => String(n).padStart(2, "0");
  const text = wallDate.getFullYear() + "-" + pad(wallDate.getMonth() + 1) + "-" + pad(wallDate.getDate()) + " " + pad(wallDate.getHours()) + ":" + pad(wallDate.getMinutes()) + ":" + pad(wallDate.getSeconds());
  return new Date(new DateTime(text, zone(household)).string().replace(" ", "T"));
}
function midnight(household, at) {
  return new Date(new DateTime(day(household, at) + " 00:00:00", zone(household)).string().replace(" ", "T"));
}
// Recurring arithmetic uses UTC fields as a timezone-neutral wall-clock carrier.
// A local Date cannot represent household times inside the host's DST gap.
function wallUtc(household, at) {
  return new Date(new DateTime(at.toISOString()).time().in(new Timezone(zone(household))).format("2006-01-02T15:04:05") + "Z");
}
function instantUtc(household, wallDate) {
  return new Date(new DateTime(wallDate.toISOString().slice(0, 19).replace("T", " "), zone(household)).string().replace(" ", "T"));
}
module.exports = { zone, day, wall, instant, midnight, wallUtc, instantUtc };
