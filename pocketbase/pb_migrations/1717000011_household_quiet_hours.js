/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    households.fields.add(new TextField({ name: "quiet_start", max: 5 }));
    households.fields.add(new TextField({ name: "quiet_end", max: 5 }));
    app.save(households);
  },
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    const start = households.fields.getByName("quiet_start");
    if (start) households.fields.remove(start);
    const end = households.fields.getByName("quiet_end");
    if (end) households.fields.remove(end);
    app.save(households);
  },
);
