/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  for (const name of ["chores", "chore_templates"]) {
    const c = app.findCollectionByNameOrId(name);
    c.fields.add(new NumberField({ name: "timer_minutes", onlyInt: true, min: 0, max: 480 }));
    app.save(c);
  }
  const c = app.findCollectionByNameOrId("assignments");
  c.fields.add(new DateField({ name: "timer_started_at" }));
  c.fields.add(new NumberField({ name: "timer_minutes", onlyInt: true, min: 0, max: 480 }));
  app.save(c);
}, (app) => {
  for (const name of ["chores", "chore_templates", "assignments"]) {
    const c = app.findCollectionByNameOrId(name);
    c.fields.removeByName("timer_minutes");
    if (name === "assignments") c.fields.removeByName("timer_started_at");
    app.save(c);
  }
});
