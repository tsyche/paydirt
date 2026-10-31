/// <reference path="../pb_data/types.d.ts" />

// Per-chore "normal" repeat limit: chores.max_per_period (and the same on
// chore_templates, so applying a template keeps it). 0/unset = no limit. The
// window comes from the chore's cadence (see packages/shared/src/choreLimit.ts).
// Parents get a warn-and-override prompt at assign time; nothing is enforced
// server-side, and the daily cron's recurring auto-assignment is untouched.
migrate(
  (app) => {
    for (const name of ["chores", "chore_templates"]) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.add(new NumberField({ name: "max_per_period", onlyInt: true, min: 0 }));
      app.save(c);
    }
  },
  (app) => {
    for (const name of ["chores", "chore_templates"]) {
      const c = app.findCollectionByNameOrId(name);
      const f = c.fields.getByName("max_per_period");
      if (f) c.fields.remove(f);
      app.save(c);
    }
  }
);
