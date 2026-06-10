/// <reference path="../pb_data/types.d.ts" />

// Savings goals: kid-owned named targets with progress tracked against the
// kid's balance. A hook (goals.pb.js) marks them achieved + notifies when the
// balance crosses the target.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const goals = new Collection({
      type: "base",
      name: "savings_goals",
      fields: [
        { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "name", type: "text", required: true },
        { name: "target", type: "number", required: true },
        { name: "achieved", type: "bool" },
        { name: "achieved_at", type: "date" },
      ],
    });
    goals.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    goals.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));

    const householdRead = "@request.auth.household = child.household";
    const ownerOrParent =
      "@request.auth.id = child || (@request.auth.role = 'parent' && @request.auth.household = child.household)";
    goals.listRule = householdRead;
    goals.viewRule = householdRead;
    goals.createRule = ownerOrParent;
    goals.updateRule = ownerOrParent;
    goals.deleteRule = ownerOrParent;

    app.save(goals);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("savings_goals"));
    } catch (_) {
      // already gone
    }
  },
);
