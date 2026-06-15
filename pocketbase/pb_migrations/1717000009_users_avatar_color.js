/// <reference path="../pb_data/types.d.ts" />

// Per-kid avatar emoji and accent color. Shown on both mobile kid screens
// and the parent dashboard kid cards. Set by the parent from the web UI.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "avatar", max: 8 }));
    users.fields.add(new TextField({ name: "color", max: 16 }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.remove("avatar");
    users.fields.remove("color");
    app.save(users);
  },
);
