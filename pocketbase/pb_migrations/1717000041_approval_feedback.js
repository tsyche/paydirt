/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("assignments");
  collection.fields.add(new TextField({ name: "approval_comment", max: 500 }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("assignments");
  collection.fields.removeByName("approval_comment");
  app.save(collection);
});
