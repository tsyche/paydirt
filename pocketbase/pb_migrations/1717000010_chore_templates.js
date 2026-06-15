/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    const dao = new Dao(db);

    const collection = new Collection();
    collection.name = "chore_templates";
    collection.type = "base";
    collection.listRule = '@request.auth.id != "" && @request.auth.household = household';
    collection.viewRule = '@request.auth.id != "" && @request.auth.household = household';
    collection.createRule = '@request.auth.id != "" && @request.auth.household = household && @request.auth.role = "parent"';
    collection.updateRule = '@request.auth.id != "" && @request.auth.household = household && @request.auth.role = "parent"';
    collection.deleteRule = '@request.auth.id != "" && @request.auth.household = household && @request.auth.role = "parent"';

    collection.schema = new Schema([
      new SchemaField({ name: "household", type: "relation", required: true, options: { collectionId: dao.findCollectionByNameOrId("households").id, maxSelect: 1, cascadeDelete: true } }),
      new SchemaField({ name: "name", type: "text", required: true, options: { max: 200 } }),
      new SchemaField({ name: "description", type: "text", options: { max: 1000 } }),
      new SchemaField({ name: "reward", type: "number", required: true, options: { min: 0 } }),
      new SchemaField({ name: "type", type: "select", required: true, options: { maxSelect: 1, values: ["oneoff", "recurring"] } }),
      new SchemaField({ name: "cadence", type: "text", options: { max: 50 } }),
      new SchemaField({ name: "photo_required", type: "bool" }),
      new SchemaField({ name: "race", type: "bool" }),
      new SchemaField({ name: "reminder_time", type: "text", options: { max: 10 } }),
    ]);

    dao.saveCollection(collection);
  },
  (db) => {
    const dao = new Dao(db);
    const col = dao.findCollectionByNameOrId("chore_templates");
    dao.deleteCollection(col);
  }
);
