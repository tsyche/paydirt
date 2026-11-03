/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const hh = app.findCollectionByNameOrId("households");
  hh.fields.add(new TextField({ name: "grant_timezone", max: 100 }));
  hh.fields.add(new NumberField({ name: "grant_expiry_days", onlyInt: true, min: 0, max: 365 }));
  app.save(hh);
  const users = app.findCollectionByNameOrId("users");
  for (const name of ["grant_weekday_window", "grant_weekend_window"]) users.fields.add(new TextField({ name, max: 11 }));
  app.save(users);
}, (app) => {
  const hh = app.findCollectionByNameOrId("households");
  hh.fields.removeByName("grant_timezone"); hh.fields.removeByName("grant_expiry_days"); app.save(hh);
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("grant_weekday_window"); users.fields.removeByName("grant_weekend_window"); app.save(users);
});
