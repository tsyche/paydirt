/// <reference path="../pb_data/types.d.ts" />

// Screen-time pricing + Family Link targets (Phase 2).
//  - households.screen_rate: parentBucks per minute (0/unset = 1:1)
//  - spend_requests.screen_minutes: set = screen-time request; a hook prices it
//  - users.fl_child_id / fl_device_id: per-kid Family Link grant target. The
//    API key and browser session are secrets and stay out of the DB (env on bb).
// Patterns match assertFamilyLinkId in packages/shared/src/familylink.ts.
migrate(
  (app) => {
    const households = app.findCollectionByNameOrId("households");
    households.fields.add(new NumberField({ name: "screen_rate", min: 0 }));
    app.save(households);

    const spendRequests = app.findCollectionByNameOrId("spend_requests");
    spendRequests.fields.add(new NumberField({ name: "screen_minutes", onlyInt: true, min: 15, max: 60 }));
    app.save(spendRequests);

    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "fl_child_id", pattern: "^\\d{10,30}$" }));
    users.fields.add(new TextField({ name: "fl_device_id", pattern: "^[a-z0-9]{20,80}$" }));
    app.save(users);
  },
  (app) => {
    const drop = (collection, names) => {
      const c = app.findCollectionByNameOrId(collection);
      for (const n of names) {
        const f = c.fields.getByName(n);
        if (f) c.fields.remove(f);
      }
      app.save(c);
    };
    drop("households", ["screen_rate"]);
    drop("spend_requests", ["screen_minutes"]);
    drop("users", ["fl_child_id", "fl_device_id"]);
  }
);
