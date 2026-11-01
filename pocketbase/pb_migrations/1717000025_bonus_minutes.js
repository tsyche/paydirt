/// <reference path="../pb_data/types.d.ts" />

// Per-chore pay mode: chores.pay_mode ('bucks' | 'time' | 'both'; empty = bucks)
// and chores.reward_minutes (screen minutes granted on approval via the Family
// Link queue). Same two fields on chore_templates so applying a template keeps
// them. `reward` stops being required because a time-only chore pays 0 bucks
// (PocketBase treats 0 as blank on a required number). Pay-mode consistency is
// validated in guards.pb.js. Approving a chore with minutes writes a
// time_grants row (one per assignment) that the queue worker grants; clients
// can only list/view it and confirm a manual grant.
migrate(
  (app) => {
    for (const name of ["chores", "chore_templates"]) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.getByName("reward").required = false;
      c.fields.add(new SelectField({ name: "pay_mode", maxSelect: 1, values: ["bucks", "time", "both"] }));
      c.fields.add(new NumberField({ name: "reward_minutes", onlyInt: true, min: 0, max: 120 }));
      app.save(c);
    }

    const users = app.findCollectionByNameOrId("users");
    const assignments = app.findCollectionByNameOrId("assignments");
    const grants = new Collection({
      type: "base",
      name: "time_grants",
      fields: [
        { name: "child", type: "relation", required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id },
        { name: "assignment", type: "relation", maxSelect: 1, collectionId: assignments.id },
        { name: "minutes", type: "number", required: true, onlyInt: true, min: 1 },
        { name: "description", type: "text" },
        { name: "grant_status", type: "select", maxSelect: 1, values: ["queued", "granted", "manual", "manual_done"] },
        { name: "grant_error", type: "text", max: 300 },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_time_grants_assignment ON time_grants (assignment) WHERE assignment != ''"],
    });
    grants.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    grants.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
    grants.listRule = "@request.auth.household = child.household";
    grants.viewRule = "@request.auth.household = child.household";
    // Created only by the approval hook (app context); parents confirm manual grants.
    grants.updateRule = "@request.auth.role = 'parent' && @request.auth.household = child.household";
    app.save(grants);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("time_grants"));
    } catch (_) {
      // already gone
    }
    for (const name of ["chores", "chore_templates"]) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.removeByName("pay_mode");
      c.fields.removeByName("reward_minutes");
      c.fields.getByName("reward").required = true;
      app.save(c);
    }
  },
);
