/// <reference path="../pb_data/types.d.ts" />

// Inbox: a per-user copy of every push the server sends (lib/ntfy.js writes it),
// so alerts and parent broadcasts survive after the system notification is gone.
// Mirrors packages/shared/src/types.ts. Written only by server hooks (no create
// rule); the owner can list, view and delete their own items. Pruned daily.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const inbox = new Collection({
      type: "base",
      name: "inbox",
      fields: [
        { name: "user", type: "relation", required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id },
        { name: "title", type: "text", required: true },
        { name: "body", type: "text" },
        { name: "type", type: "text" },
      ],
      indexes: ["CREATE INDEX idx_inbox_user_created ON inbox (user, created)"],
    });
    inbox.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    inbox.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));

    inbox.listRule = "@request.auth.id = user";
    inbox.viewRule = "@request.auth.id = user";
    inbox.deleteRule = "@request.auth.id = user";

    app.save(inbox);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("inbox"));
    } catch (_) {
      // already gone
    }
  },
);
