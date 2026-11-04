/// <reference path="../pb_data/types.d.ts" />

// Sparse day overrides: keys are Sunday=0 through Saturday=6.
migrate((app) => {
  for (const name of ["households", "users"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new TextField({ name: "grant_day_windows", max: 10000 }));
    app.save(collection);
  }
}, (app) => {
  for (const name of ["households", "users"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("grant_day_windows");
    app.save(collection);
  }
});
