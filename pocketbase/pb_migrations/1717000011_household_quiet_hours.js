/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    const dao = new Dao(db);
    const col = dao.findCollectionByNameOrId("households");

    col.schema.addField(new SchemaField({ name: "quiet_start", type: "text", options: { max: 5 } }));
    col.schema.addField(new SchemaField({ name: "quiet_end", type: "text", options: { max: 5 } }));

    dao.saveCollection(col);
  },
  (db) => {
    const dao = new Dao(db);
    const col = dao.findCollectionByNameOrId("households");
    col.schema.removeField("quiet_start");
    col.schema.removeField("quiet_end");
    dao.saveCollection(col);
  }
);
