/// <reference path="../pb_data/types.d.ts" />

// Parent-controlled "calm mode" per kid. Default off — the playful extras
// (balance count-up, approval celebration, badge shelf) are on out of the box;
// a parent can dial a sensitive kid's home screen back to the quiet baseline.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new BoolField({ name: "calm_mode" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const field = users.fields.getByName("calm_mode");
    if (field) users.fields.remove(field);
    app.save(users);
  }
);
