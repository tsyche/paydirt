/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("spend_requests");
    c.fields.add(new SelectField({
      name: "grant_status", maxSelect: 1,
      values: ["queued", "granted", "manual", "manual_done"],
    }));
    c.fields.add(new TextField({ name: "grant_error", max: 300 }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("spend_requests");
    c.fields.removeByName("grant_status");
    c.fields.removeByName("grant_error");
    app.save(c);
  },
);
