/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const c = app.findCollectionByNameOrId("time_grants");
  c.createRule = "@request.auth.role = 'parent' && @request.auth.household = child.household";
  c.fields.add(new RelationField({ name: "given_by", collectionId: app.findCollectionByNameOrId("users").id, maxSelect: 1 }));
  c.fields.add(new TextField({ name: "request_key", max: 100 }));
  c.indexes.push("CREATE UNIQUE INDEX idx_time_grant_request_key ON time_grants (given_by, request_key) WHERE request_key != ''");
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("time_grants");
  c.createRule = null;
  c.indexes = c.indexes.filter((i) => !i.includes("idx_time_grant_request_key"));
  c.fields.removeByName("given_by"); c.fields.removeByName("request_key");
  app.save(c);
});
