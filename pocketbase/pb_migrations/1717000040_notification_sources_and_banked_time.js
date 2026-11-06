/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const inbox = app.findCollectionByNameOrId("inbox");
  inbox.fields.add(new TextField({ name: "source", max: 100 }));
  inbox.indexes.push("CREATE INDEX idx_inbox_source ON inbox (source)");
  app.save(inbox);
  for (const name of ["spend_requests", "time_grants"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new NumberField({ name: "grant_delivered_seconds", min: 0, onlyInt: true }));
    app.save(collection);
  }
}, (app) => {
  const inbox = app.findCollectionByNameOrId("inbox");
  inbox.fields.removeByName("source");
  inbox.indexes = inbox.indexes.filter((index) => !index.includes("idx_inbox_source"));
  app.save(inbox);
  for (const name of ["spend_requests", "time_grants"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("grant_delivered_seconds");
    app.save(collection);
  }
});
