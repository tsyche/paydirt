/// <reference path="../pb_data/types.d.ts" />

// Phase 1 / 1.5 field additions. Mirrors packages/shared/src/types.ts.
//
// households: bank_threshold, expiry_days, goods_rate, nudge_hours, paused
// users:      streak_count
// chores:     due_at, race, reminder_time
// assignments: kid_response, reaction, reminder_stage, kid_reminder_at,
//              last_reminded, nudged_at, swap_to; status gains "closed"
// currency_transactions: expiry_processed
//
// Also widens the assignments update rule so a swap target can respond to a
// swap offer (guards.pb.js constrains what they may actually change).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const households = app.findCollectionByNameOrId("households");
    // 0 = off for all numeric knobs
    households.fields.add(new NumberField({ name: "bank_threshold" }));
    households.fields.add(new NumberField({ name: "expiry_days" }));
    households.fields.add(new NumberField({ name: "goods_rate" }));
    households.fields.add(new NumberField({ name: "nudge_hours" }));
    households.fields.add(new BoolField({ name: "paused" }));
    app.save(households);

    users.fields.add(new NumberField({ name: "streak_count" }));
    app.save(users);

    const chores = app.findCollectionByNameOrId("chores");
    chores.fields.add(new DateField({ name: "due_at" }));
    chores.fields.add(new BoolField({ name: "race" }));
    chores.fields.add(new TextField({ name: "reminder_time" })); // "HH:MM" 24h
    app.save(chores);

    const assignments = app.findCollectionByNameOrId("assignments");
    assignments.fields.add(new TextField({ name: "kid_response" }));
    assignments.fields.add(new TextField({ name: "reaction" }));
    assignments.fields.add(new NumberField({ name: "reminder_stage" }));
    assignments.fields.add(new DateField({ name: "kid_reminder_at" }));
    assignments.fields.add(new DateField({ name: "last_reminded" }));
    assignments.fields.add(new DateField({ name: "nudged_at" }));
    assignments.fields.add(
      new RelationField({ name: "swap_to", maxSelect: 1, collectionId: users.id }),
    );
    const status = assignments.fields.getByName("status");
    status.values = ["assigned", "completed", "approved", "rejected", "closed"];
    assignments.updateRule =
      "@request.auth.id = child || @request.auth.id = swap_to || (@request.auth.role = 'parent' && @request.auth.household = chore.household)";
    app.save(assignments);

    const txs = app.findCollectionByNameOrId("currency_transactions");
    txs.fields.add(new BoolField({ name: "expiry_processed" }));
    app.save(txs);
  },
  (app) => {
    const strip = (name, fields) => {
      const c = app.findCollectionByNameOrId(name);
      for (const f of fields) {
        const field = c.fields.getByName(f);
        if (field) c.fields.remove(field);
      }
      app.save(c);
    };
    strip("households", ["bank_threshold", "expiry_days", "goods_rate", "nudge_hours", "paused"]);
    strip("users", ["streak_count"]);
    strip("chores", ["due_at", "race", "reminder_time"]);
    strip("currency_transactions", ["expiry_processed"]);

    const assignments = app.findCollectionByNameOrId("assignments");
    for (const f of ["kid_response", "reaction", "reminder_stage", "kid_reminder_at", "last_reminded", "nudged_at", "swap_to"]) {
      const field = assignments.fields.getByName(f);
      if (field) assignments.fields.remove(field);
    }
    const status = assignments.fields.getByName("status");
    status.values = ["assigned", "completed", "approved", "rejected"];
    assignments.updateRule =
      "@request.auth.id = child || (@request.auth.role = 'parent' && @request.auth.household = chore.household)";
    app.save(assignments);
  },
);
