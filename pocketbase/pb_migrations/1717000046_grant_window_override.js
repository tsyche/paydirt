/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  for (const name of ["time_grants", "spend_requests"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new BoolField({ name: "grant_window_override" }));
    app.save(collection);
  }
}, (app) => {
  for (const name of ["time_grants", "spend_requests"]) {
    if (app.findRecordsByFilter(name, "grant_window_override = true && grant_status = 'queued'", "", 1).length) {
      throw new Error("Finish queued delivery overrides before rolling back this migration.");
    }
  }
  for (const name of ["time_grants", "spend_requests"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("grant_window_override");
    app.save(collection);
  }
});
