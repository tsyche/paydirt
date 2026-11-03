/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const c = app.findCollectionByNameOrId("assignments");
  c.fields.add(new NumberField({ name: "credit_percent", onlyInt: true, min: 0, max: 100 }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("assignments");
  c.fields.removeByName("credit_percent");
  app.save(c);
});
