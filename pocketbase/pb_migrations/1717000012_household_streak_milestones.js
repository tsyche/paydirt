/// <reference path="../pb_data/types.d.ts" />

// Adds per-household streak milestone bonus overrides.
// Fields default to 0 (= use hardcoded defaults in goals.pb.js).
// households: streak_bonus_3, streak_bonus_7, streak_bonus_14, streak_bonus_30
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    households.fields.add(new NumberField({ name: "streak_bonus_3" }));
    households.fields.add(new NumberField({ name: "streak_bonus_7" }));
    households.fields.add(new NumberField({ name: "streak_bonus_14" }));
    households.fields.add(new NumberField({ name: "streak_bonus_30" }));
    app.save(households);
  },
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    for (const f of ["streak_bonus_3", "streak_bonus_7", "streak_bonus_14", "streak_bonus_30"]) {
      const field = households.fields.getByName(f);
      if (field) households.fields.remove(field);
    }
    app.save(households);
  }
);
