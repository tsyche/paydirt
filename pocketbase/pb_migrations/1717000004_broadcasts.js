/// <reference path="../pb_data/types.d.ts" />

// Broadcasts: a one-liner from a parent to every kid in the household.
// Creating a record triggers the ntfy fan-out hook (notifications.pb.js).
// Mirrors packages/shared/src/types.ts.
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    const users = app.findCollectionByNameOrId("users");

    const broadcasts = new Collection({
      type: "base",
      name: "broadcasts",
      fields: [
        { name: "household", type: "relation", required: true, maxSelect: 1, collectionId: households.id },
        { name: "sender", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "message", type: "text", required: true },
      ],
    });
    broadcasts.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    broadcasts.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));

    // Household-scoped reads; only parents send. No update/delete — broadcasts
    // are fire-and-forget history.
    broadcasts.listRule = "@request.auth.household = household";
    broadcasts.viewRule = "@request.auth.household = household";
    broadcasts.createRule =
      "@request.auth.role = 'parent' && @request.auth.household = household";

    app.save(broadcasts);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("broadcasts"));
    } catch (_) {
      // already gone
    }
  },
);
