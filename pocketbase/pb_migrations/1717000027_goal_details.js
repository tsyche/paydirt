/// <reference path="../pb_data/types.d.ts" />

// Optional free-text notes on a savings goal, so goal names can stay short.
migrate(
  (app) => {
    const goals = app.findCollectionByNameOrId("savings_goals");
    goals.fields.add(new TextField({ name: "details", max: 500 }));
    app.save(goals);
  },
  (app) => {
    const goals = app.findCollectionByNameOrId("savings_goals");
    const f = goals.fields.getByName("details");
    if (f) goals.fields.remove(f);
    app.save(goals);
  }
);
