/// <reference path="../pb_data/types.d.ts" />

// Keep existing values and rules; expand the old single-range storage limit.
migrate((app) => {
  for (const name of ["households", "users"]) {
    const collection = app.findCollectionByNameOrId(name);
    for (const field of ["grant_weekday_window", "grant_weekend_window"]) {
      collection.fields.getByName(field).max = 10000;
    }
    app.save(collection);
  }
}, (app) => {
  // Refuse an incompatible rollback rather than truncate or invalidate saved schedules.
  for (const name of ["households", "users"]) {
    const rows = app.findRecordsByFilter(name,
      "grant_weekday_window ~ ',' || grant_weekend_window ~ ','", "", 1, 0);
    if (rows.length) throw new Error("Restore single delivery windows before rolling back the window storage limit.");
  }
  for (const name of ["households", "users"]) {
    const collection = app.findCollectionByNameOrId(name);
    for (const field of ["grant_weekday_window", "grant_weekend_window"]) {
      collection.fields.getByName(field).max = 11;
    }
    app.save(collection);
  }
});
