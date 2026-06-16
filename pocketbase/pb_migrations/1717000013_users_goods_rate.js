/// <reference path="../pb_data/types.d.ts" />

// Per-kid goods rate override. When set, overrides the household goods_rate for
// that kid's balance/conversion display. 0/unset = fall back to household rate.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new NumberField({ name: "goods_rate" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const field = users.fields.getByName("goods_rate");
    if (field) users.fields.remove(field);
    app.save(users);
  }
);
