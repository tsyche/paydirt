/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");

    const templates = new Collection({
      type: "base",
      name: "chore_templates",
      fields: [
        { name: "household", type: "relation", required: true, maxSelect: 1, collectionId: households.id },
        { name: "name", type: "text", required: true, max: 200 },
        { name: "description", type: "text", max: 1000 },
        { name: "reward", type: "number", required: true },
        { name: "type", type: "select", required: true, maxSelect: 1, values: ["oneoff", "recurring"] },
        { name: "cadence", type: "text", max: 50 },
        { name: "photo_required", type: "bool" },
        { name: "race", type: "bool" },
        { name: "reminder_time", type: "text", max: 10 },
      ],
    });
    templates.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    templates.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));

    const householdMember = "@request.auth.id != '' && @request.auth.household = household";
    const householdParent =
      "@request.auth.id != '' && @request.auth.household = household && @request.auth.role = 'parent'";
    templates.listRule = householdMember;
    templates.viewRule = householdMember;
    templates.createRule = householdParent;
    templates.updateRule = householdParent;
    templates.deleteRule = householdParent;

    app.save(templates);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("chore_templates"));
    } catch (_) {
      // already gone
    }
  },
);
