/// <reference path="../pb_data/types.d.ts" />

// Add created/updated autodate fields to the base collections.
//
// PocketBase v0.23+ no longer adds created/updated automatically — base
// collections only get them if you declare them. The shared client sorts
// several lists by `created` (e.g. spend requests, transactions), which 400s
// when the field doesn't exist. Add them everywhere so sort/filter by
// timestamp works and we get audit timestamps for free.
migrate(
  (app) => {
    const collections = [
      "households",
      "chores",
      "assignments",
      "spend_requests",
      "currency_transactions",
    ];

    for (const name of collections) {
      const c = app.findCollectionByNameOrId(name);
      if (!c.fields.getByName("created")) {
        c.fields.add(
          new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        );
      }
      if (!c.fields.getByName("updated")) {
        c.fields.add(
          new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
        );
      }
      app.save(c);
    }
  },
  (app) => {
    const collections = [
      "households",
      "chores",
      "assignments",
      "spend_requests",
      "currency_transactions",
    ];

    for (const name of collections) {
      const c = app.findCollectionByNameOrId(name);
      for (const f of ["created", "updated"]) {
        const field = c.fields.getByName(f);
        if (field) c.fields.remove(field);
      }
      app.save(c);
    }
  },
);
