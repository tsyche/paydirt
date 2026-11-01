/// <reference path="../pb_data/types.d.ts" />

// Remembers which starter chore a chore came from, so renaming it ("Feed the pet" -> "Feed the cats")
// doesn't make the Starter chores picker offer the original again.
migrate(
  (app) => {
    const chores = app.findCollectionByNameOrId("chores");
    chores.fields.add(new TextField({ name: "starter_key", max: 100 }));
    app.save(chores);
  },
  (app) => {
    const chores = app.findCollectionByNameOrId("chores");
    const f = chores.fields.getByName("starter_key");
    if (f) chores.fields.remove(f);
    app.save(chores);
  }
);
