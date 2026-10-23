/// <reference path="../pb_data/types.d.ts" />

// Auto-save to savings goals: a per-goal percentage of each approved earn
// is automatically allocated to the goal.
migrate(
  (app) => {
    const goals = app.findCollectionByNameOrId("savings_goals");
    goals.fields.add(new NumberField({ name: "auto_save_percent" }));
    app.save(goals);
  },
  (app) => {
    const goals = app.findCollectionByNameOrId("savings_goals");
    const f = goals.fields.getByName("auto_save_percent");
    if (f) goals.fields.remove(f);
    app.save(goals);
  }
);
