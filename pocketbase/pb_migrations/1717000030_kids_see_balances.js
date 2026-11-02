/// <reference path="../pb_data/types.d.ts" />

// households.kids_see_balances: when true, kids can see their siblings' grit balances.
// Default (unset/false) keeps balances private between kids; enforced by the
// onRecordEnrich hook in pb_hooks/guards.pb.js, not just the UI.
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    households.fields.add(new BoolField({ name: "kids_see_balances" }));
    app.save(households);
  },
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    households.fields.removeByName("kids_see_balances");
    app.save(households);
  },
);
