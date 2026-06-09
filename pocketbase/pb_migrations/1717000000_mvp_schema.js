/// <reference path="../pb_data/types.d.ts" />

// PayDirt MVP schema. Mirrors packages/shared/src/types.ts and docs/DATA_MODEL.md.
migrate(
  (app) => {
    // ── households ──────────────────────────────────────────────
    const households = new Collection({
      type: "base",
      name: "households",
      fields: [{ name: "name", type: "text", required: true }],
    });
    app.save(households);

    // ── users (extend built-in auth collection) ─────────────────
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(
      new SelectField({
        name: "role",
        required: true,
        maxSelect: 1,
        values: ["parent", "child"],
      }),
    );
    users.fields.add(new TextField({ name: "display_name", required: true }));
    users.fields.add(
      new RelationField({
        name: "household",
        required: true,
        maxSelect: 1,
        collectionId: households.id,
      }),
    );
    users.fields.add(new TextField({ name: "ntfy_topic" }));
    users.fields.add(new NumberField({ name: "balance" }));
    users.fields.add(new BoolField({ name: "simplified_mode" }));
    app.save(users);

    // ── chores ──────────────────────────────────────────────────
    const chores = new Collection({
      type: "base",
      name: "chores",
      fields: [
        { name: "household", type: "relation", required: true, maxSelect: 1, collectionId: households.id },
        { name: "name", type: "text", required: true },
        { name: "description", type: "text" },
        { name: "reward", type: "number", required: true },
        { name: "type", type: "select", required: true, maxSelect: 1, values: ["oneoff", "recurring"] },
        { name: "cadence", type: "text" },
        { name: "photo_required", type: "bool" },
        { name: "created_by", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "active", type: "bool" },
      ],
    });
    app.save(chores);

    // ── assignments ─────────────────────────────────────────────
    const assignments = new Collection({
      type: "base",
      name: "assignments",
      fields: [
        { name: "chore", type: "relation", required: true, maxSelect: 1, collectionId: chores.id },
        { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "status", type: "select", required: true, maxSelect: 1, values: ["assigned", "completed", "approved", "rejected"] },
        { name: "completed_at", type: "date" },
        { name: "approved_at", type: "date" },
        { name: "photo", type: "file", maxSelect: 1 },
        { name: "rejection_message", type: "text" },
      ],
    });
    app.save(assignments);

    // ── spend_requests ──────────────────────────────────────────
    const spendRequests = new Collection({
      type: "base",
      name: "spend_requests",
      fields: [
        { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "amount", type: "number", required: true },
        { name: "description", type: "text", required: true },
        { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "approved", "denied"] },
        { name: "resolved_at", type: "date" },
        { name: "resolved_by", type: "relation", maxSelect: 1, collectionId: users.id },
      ],
    });
    app.save(spendRequests);

    // ── currency_transactions ───────────────────────────────────
    const transactions = new Collection({
      type: "base",
      name: "currency_transactions",
      fields: [
        { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
        { name: "amount", type: "number", required: true },
        { name: "type", type: "select", required: true, maxSelect: 1, values: ["earn", "spend", "manual_adjustment"] },
        { name: "reason", type: "text" },
        { name: "related_assignment", type: "relation", maxSelect: 1, collectionId: assignments.id },
        { name: "related_spend_request", type: "relation", maxSelect: 1, collectionId: spendRequests.id },
      ],
    });
    app.save(transactions);
  },
  (app) => {
    // ── rollback (reverse dependency order) ─────────────────────
    for (const name of [
      "currency_transactions",
      "spend_requests",
      "assignments",
      "chores",
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        // already gone
      }
    }
    // strip the custom fields we added to users
    const users = app.findCollectionByNameOrId("users");
    for (const f of ["role", "display_name", "household", "ntfy_topic", "balance", "simplified_mode"]) {
      const field = users.fields.getByName(f);
      if (field) users.fields.remove(field);
    }
    app.save(users);

    try {
      app.delete(app.findCollectionByNameOrId("households"));
    } catch (_) {
      // already gone
    }
  },
);
