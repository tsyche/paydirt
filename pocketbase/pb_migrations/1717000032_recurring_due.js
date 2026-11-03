/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  for (const name of ["chores", "chore_templates"]) {
    const c = app.findCollectionByNameOrId(name);
    c.fields.add(new TextField({ name: "due_time", pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" }));
    c.fields.add(new NumberField({ name: "due_day", onlyInt: true, min: 0, max: 31 }));
    app.save(c);
  }
  const c = app.findCollectionByNameOrId("assignments");
  c.fields.add(new DateField({ name: "due_at" }));
  app.save(c);
}, (app) => {
  for (const name of ["chores", "chore_templates"]) {
    const c = app.findCollectionByNameOrId(name);
    c.fields.removeByName("due_time");
    c.fields.removeByName("due_day");
    app.save(c);
  }
  const c = app.findCollectionByNameOrId("assignments");
  c.fields.removeByName("due_at");
  app.save(c);
});
