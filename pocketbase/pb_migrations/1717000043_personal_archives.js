/// <reference path="../pb_data/types.d.ts" />

// Personal display preferences; source records and financial history stay intact.
migrate((app) => {
  const sources = { inbox: "inbox", kudos: "kudos", assignment: "assignments", spend_request: "spend_requests", time_grant: "time_grants" };
  const collection = new Collection({
    name: "archives", type: "base",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: "@request.auth.id != ''",
    deleteRule: "user = @request.auth.id",
  });
  collection.fields.add(new RelationField({ name: "user", collectionId: app.findCollectionByNameOrId("users").id, required: true, maxSelect: 1, cascadeDelete: true }));
  for (const [field, source] of Object.entries(sources)) {
    collection.fields.add(new RelationField({ name: field, collectionId: app.findCollectionByNameOrId(source).id, maxSelect: 1, cascadeDelete: true }));
    collection.indexes.push("CREATE UNIQUE INDEX idx_archives_" + field + " ON archives (user, " + field + ") WHERE " + field + " != ''");
  }
  collection.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(collection);
}, (app) => {
  if (app.findRecordsByFilter("archives", "", "", 1, 0).length) {
    throw new Error("Restore archived items before rolling back personal archives.");
  }
  app.delete(app.findCollectionByNameOrId("archives"));
});
