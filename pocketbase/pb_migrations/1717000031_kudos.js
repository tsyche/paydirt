/// <reference path="../pb_data/types.d.ts" />

// Parent "Great work" awards. The currency hook turns every kudos record into
// one immutable `kudos` ledger credit; the award itself holds private history
// and the server-owned celebration acknowledgement.
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    const users = app.findCollectionByNameOrId("users");

    households.fields.add(new NumberField({ name: "kudos_default_bucks", min: 1 }));
    app.save(households);

    const kudos = new Collection({
      type: "base",
      name: "kudos",
      fields: [
        { name: "household", type: "relation", required: true, maxSelect: 1, cascadeDelete: true, collectionId: households.id },
        { name: "child", type: "relation", required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id },
        { name: "given_by", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "reason", type: "text", max: 500 },
        { name: "bucks", type: "number", required: true, min: 1 },
        { name: "seen_at", type: "date" },
      ],
      indexes: ["CREATE INDEX idx_kudos_child_created ON kudos (child, created)"],
    });
    kudos.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    kudos.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
    kudos.listRule = "@request.auth.id = child || (@request.auth.role = 'parent' && @request.auth.household = household)";
    kudos.viewRule = kudos.listRule;
    kudos.createRule = "@request.auth.role = 'parent' && @request.auth.household = household";
    // A kid may only set their own unseen award to seen. guards.pb.js locks
    // every other field and makes the acknowledgement one-way.
    kudos.updateRule = "@request.auth.id = child";
    app.save(kudos);

    const txs = app.findCollectionByNameOrId("currency_transactions");
    txs.fields.getByName("type").values.push("kudos");
    txs.fields.add(new RelationField({ name: "related_kudos", maxSelect: 1, collectionId: kudos.id }));
    app.save(txs);
  },
  (app) => {
    const txs = app.findCollectionByNameOrId("currency_transactions");
    txs.fields.removeByName("related_kudos");
    const type = txs.fields.getByName("type");
    type.values = type.values.filter((value) => value !== "kudos");
    app.save(txs);

    try {
      app.delete(app.findCollectionByNameOrId("kudos"));
    } catch (_) {
      // already gone
    }

    const households = app.findCollectionByNameOrId("households");
    households.fields.removeByName("kudos_default_bucks");
    app.save(households);
  },
);
