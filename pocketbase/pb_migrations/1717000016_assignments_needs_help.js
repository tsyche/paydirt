/// <reference path="../pb_data/types.d.ts" />

// "I need help" flag on an assignment. A kid can tap it when stuck; parents
// are notified and the assignment is marked as needing attention.
migrate(
  (app) => {
    const assignments = app.findCollectionByNameOrId("assignments");
    assignments.fields.add(new BoolField({ name: "needs_help" }));
    app.save(assignments);
  },
  (app) => {
    const assignments = app.findCollectionByNameOrId("assignments");
    const field = assignments.fields.getByName("needs_help");
    if (field) assignments.fields.remove(field);
    app.save(assignments);
  }
);
