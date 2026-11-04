/// <reference path="../pb_data/types.d.ts" />
// PayDirt is a single-household deployment. Keep the cron clock aligned with
// that household, including after a settings change (no restart needed).
onBootstrap((e) => {
  e.next();
  const households = e.app.findRecordsByFilter("households", "id != ''", "created", 1, 0);
  const zone = households.length ? households[0].getString("grant_timezone") : "";
  e.app.cron().setTimezone(new Timezone(zone || "America/Los_Angeles"));
});
onRecordAfterUpdateSuccess((e) => {
  if (e.record.getString("grant_timezone") !== e.record.original().getString("grant_timezone")) {
    e.app.cron().setTimezone(new Timezone(e.record.getString("grant_timezone") || "America/Los_Angeles"));
  }
  e.next();
}, "households");
onRecordAfterCreateSuccess((e) => {
  e.app.cron().setTimezone(new Timezone(e.record.getString("grant_timezone") || "America/Los_Angeles"));
  e.next();
}, "households");
