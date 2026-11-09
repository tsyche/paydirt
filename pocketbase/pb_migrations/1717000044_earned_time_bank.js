/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const assignments = app.findCollectionByNameOrId("assignments");
  assignments.fields.add(new SelectField({ name: "time_choice", maxSelect: 1, values: ["bank", "use"] }));
  app.save(assignments);
  const scope = "@request.auth.id != '' && (@request.auth.id = child || (@request.auth.role = 'parent' && @request.auth.household = child.household))";
  const redemptions = new Collection({
    type: "base", name: "time_redemptions", listRule: scope, viewRule: scope,
    fields: [
      { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
      { name: "minutes", type: "number", required: true, onlyInt: true, min: 15 },
      { name: "request_key", type: "text", required: true, max: 100 },
      { name: "cancelled", type: "bool" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_time_redemption_key ON time_redemptions (child, request_key)"],
  });
  redemptions.fields.add(new AutodateField({ name: "created", onCreate: true }));
  app.save(redemptions);
  const ledger = new Collection({
    type: "base", name: "time_ledger", listRule: scope, viewRule: scope,
    fields: [
      { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
      { name: "kind", type: "select", required: true, maxSelect: 1, values: ["earn", "reserve", "redeem", "release"] },
      { name: "minutes", type: "number", required: true, onlyInt: true, min: 1 },
      { name: "assignment", type: "relation", maxSelect: 1, collectionId: assignments.id },
      { name: "redemption", type: "relation", maxSelect: 1, collectionId: redemptions.id },
      { name: "event_key", type: "text", required: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_time_ledger_event ON time_ledger (event_key)", "CREATE INDEX idx_time_ledger_child ON time_ledger (child, created)"],
  });
  ledger.fields.add(new AutodateField({ name: "created", onCreate: true }));
  app.save(ledger);
  const grants = app.findCollectionByNameOrId("time_grants");
  grants.fields.add(new BoolField({ name: "grant_dispatch_started" }));
  grants.fields.add(new RelationField({ name: "redemption", maxSelect: 1, collectionId: redemptions.id }));
  grants.fields.getByName("grant_status").values.push("cancelled");
  grants.indexes.push("CREATE UNIQUE INDEX idx_time_grant_redemption ON time_grants (redemption) WHERE redemption != ''");
  grants.listRule = scope;
  grants.viewRule = scope;
  app.save(grants);
  const purchases = app.findCollectionByNameOrId("spend_requests");
  purchases.listRule = scope;
  purchases.viewRule = scope;
  app.save(purchases);
}, (app) => {
  // Removing a populated bank would destroy earned balances. Refuse rollback.
  if (app.findRecordsByFilter("time_ledger", "id != ''", "", 1).length) throw new Error("Earned-time ledger is populated; preserve/export it before rollback.");
  const grants = app.findCollectionByNameOrId("time_grants");
  grants.fields.removeByName("redemption");
  grants.fields.removeByName("grant_dispatch_started");
  grants.fields.getByName("grant_status").values = grants.fields.getByName("grant_status").values.filter((v) => v !== "cancelled");
  grants.indexes = grants.indexes.filter((i) => !i.includes("idx_time_grant_redemption"));
  app.save(grants);
  app.delete(app.findCollectionByNameOrId("time_ledger"));
  app.delete(app.findCollectionByNameOrId("time_redemptions"));
  const assignments = app.findCollectionByNameOrId("assignments");
  assignments.fields.removeByName("time_choice");
  app.save(assignments);
});
