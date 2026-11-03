/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const c = app.findCollectionByNameOrId("households");
  for (const name of ["grant_weekday_window", "grant_weekend_window"]) {
    c.fields.add(new TextField({ name, max: 11 }));
  }
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("households");
  c.fields.removeByName("grant_weekday_window");
  c.fields.removeByName("grant_weekend_window");
  app.save(c);
});
