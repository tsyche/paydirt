/// <reference path="../pb_data/types.d.ts" />

// Kid-proposed chores: a kid pitches a chore + asking price; a parent approves
// (which creates the real chore + assignment via the client) or declines.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const households = app.findCollectionByNameOrId("households");

    const proposals = new Collection({
      type: "base",
      name: "chore_proposals",
      fields: [
        { name: "household", type: "relation", required: true, maxSelect: 1, collectionId: households.id },
        { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "name", type: "text", required: true },
        { name: "description", type: "text" },
        { name: "reward_requested", type: "number", required: true },
        { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "approved", "declined"] },
        { name: "resolved_by", type: "relation", maxSelect: 1, collectionId: users.id },
      ],
    });
    proposals.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    proposals.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));

    proposals.listRule = "@request.auth.household = household";
    proposals.viewRule = "@request.auth.household = household";
    proposals.createRule = "@request.auth.id = child && @request.auth.household = household";
    proposals.updateRule =
      "@request.auth.role = 'parent' && @request.auth.household = household";
    proposals.deleteRule =
      "@request.auth.role = 'parent' && @request.auth.household = household";

    app.save(proposals);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("chore_proposals"));
    } catch (_) {
      // already gone
    }
  },
);
