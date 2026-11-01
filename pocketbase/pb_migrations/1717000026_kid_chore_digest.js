/// <reference path="../pb_data/types.d.ts" />

// Per-kid "chores for today" summary push. digest_weekday / digest_weekend are
// "HH:MM" (server-local) send times; blank = no summary that day type.
// digest_sent is the local YYYY-MM-DD of the last send (dedupe marker).
// The 3 AM recurring auto-assignment no longer pushes per chore; this summary
// replaces it. assignments.auto_created marks those cron-made rows so the
// per-assignment "New chore!" hook skips them.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "digest_weekday", max: 5 }));
    users.fields.add(new TextField({ name: "digest_weekend", max: 5 }));
    users.fields.add(new TextField({ name: "digest_sent", max: 10 }));
    app.save(users);
    const assignments = app.findCollectionByNameOrId("assignments");
    assignments.fields.add(new BoolField({ name: "auto_created" }));
    app.save(assignments);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    for (const n of ["digest_weekday", "digest_weekend", "digest_sent"]) {
      const f = users.fields.getByName(n);
      if (f) users.fields.remove(f);
    }
    app.save(users);
    const assignments = app.findCollectionByNameOrId("assignments");
    const f = assignments.fields.getByName("auto_created");
    if (f) assignments.fields.remove(f);
    app.save(assignments);
  }
);
