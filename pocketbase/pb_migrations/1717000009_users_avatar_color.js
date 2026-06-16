/// <reference path="../pb_data/types.d.ts" />

// Per-kid avatar emoji and accent color. Shown on both mobile kid screens
// and the parent dashboard kid cards. Set by the parent from the web UI.
// Named avatar_emoji (not avatar) to avoid colliding with PocketBase's
// built-in file-type "avatar" field on the users auth collection.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "avatar_emoji", max: 8 }));
    users.fields.add(new TextField({ name: "color", max: 16 }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.remove("avatar_emoji");
    users.fields.remove("color");
    app.save(users);
  },
);
