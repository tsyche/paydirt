/// <reference path="../pb_data/types.d.ts" />

// Canned kid replies to a parent broadcast (👍 ok / ❓ question / ⏰ later / 🙏 please).
// One reply per kid per broadcast. Kids create their own; the notification hook pings parents.
// Mirrors packages/shared/src/broadcastReply.ts.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const broadcasts = app.findCollectionByNameOrId("broadcasts");

    const replies = new Collection({
      type: "base",
      name: "broadcast_replies",
      fields: [
        { name: "broadcast", type: "relation", required: true, maxSelect: 1, cascadeDelete: true, collectionId: broadcasts.id },
        { name: "child", type: "relation", required: true, maxSelect: 1, cascadeDelete: true, collectionId: users.id },
        { name: "code", type: "select", required: true, maxSelect: 1, values: ["ok", "question", "later", "please"] },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_broadcast_replies_once ON broadcast_replies (broadcast, child)"],
    });
    replies.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    replies.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));

    replies.listRule = "@request.auth.household = broadcast.household";
    replies.viewRule = "@request.auth.household = broadcast.household";
    replies.createRule =
      "@request.auth.id = child && @request.auth.role != 'parent' && @request.auth.household = broadcast.household";

    app.save(replies);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("broadcast_replies"));
    } catch (_) {
      // already gone
    }
  },
);
