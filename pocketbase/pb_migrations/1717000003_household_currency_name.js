/// <reference path="../pb_data/types.d.ts" />

// Add optional currency_name to households. Defaults to empty string;
// the app falls back to "parentBucks" when not set.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("households");
    if (!c.fields.getByName("currency_name")) {
      c.fields.add(new TextField({ name: "currency_name", required: false }));
      app.save(c);
    }
  },
  (app) => {
    const c = app.findCollectionByNameOrId("households");
    c.fields.removeByName("currency_name");
    app.save(c);
  },
);
