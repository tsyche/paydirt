/// <reference path="../pb_data/types.d.ts" />

// Scheduled allowance ("payday"): recurring auto-grant of parentBucks on a cadence.
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    households.fields.add(new NumberField({ name: "allowance_amount" }));
    households.fields.add(new SelectField({ name: "allowance_cadence", maxSelect: 1, values: ["daily", "weekly"] }));
    households.fields.add(new DateField({ name: "allowance_last_paid" }));
    app.save(households);
  },
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    for (const n of ["allowance_amount", "allowance_cadence", "allowance_last_paid"]) {
      const f = households.fields.getByName(n);
      if (f) households.fields.remove(f);
    }
    app.save(households);
  }
);
