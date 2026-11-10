/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const assignments = app.findCollectionByNameOrId("assignments");
  const users = app.findCollectionByNameOrId("users");
  assignments.fields.add(new TextField({ name: "submission_note", max: 1000 }));
  assignments.fields.add(new TextField({ name: "thread_actor", max: 15 }));
  app.save(assignments);
  const scope = "@request.auth.id != '' && (@request.auth.id = child || (@request.auth.role = 'parent' && @request.auth.household = assignment.chore.household))";
  const events = new Collection({ type: "base", name: "chore_messages", listRule: scope, viewRule: scope,
    fields: [
      { name: "assignment", type: "relation", required: true, maxSelect: 1, collectionId: assignments.id },
      { name: "child", type: "relation", required: true, maxSelect: 1, collectionId: users.id },
      { name: "author", type: "relation", maxSelect: 1, collectionId: users.id },
      { name: "author_name", type: "text", required: true },
      { name: "author_role", type: "select", maxSelect: 1, values: ["parent", "child", "system"] },
      { name: "kind", type: "select", required: true, maxSelect: 1, values: ["message", "submitted", "approved", "rejected", "reopened", "closed", "legacy"] },
      { name: "body", type: "text" },
      { name: "sequence", type: "number", required: true, onlyInt: true, min: 1 },
      { name: "request_key", type: "text", max: 100 },
    ], indexes: [
      "CREATE UNIQUE INDEX idx_chore_message_sequence ON chore_messages (assignment, sequence)",
      "CREATE UNIQUE INDEX idx_chore_message_retry ON chore_messages (author, request_key) WHERE request_key != ''",
      "CREATE INDEX idx_chore_message_child ON chore_messages (child, assignment)",
    ],
  });
  events.fields.add(new AutodateField({ name: "created", onCreate: true }));
  app.save(events);
  // Preserve legacy feedback as immutable context, with unknown authors labelled.
  for (const a of app.findAllRecords("assignments")) {
    let sequence = 0;
    const kid = app.findRecordById("users", a.getString("child"));
    function add(kind, body, name, role, at) {
      const r = new Record(events);
      r.set("assignment", a.id); r.set("child", kid.id); r.set("kind", kind);
      r.set("body", body); r.set("author_name", name); r.set("author_role", role);
      r.set("sequence", ++sequence); app.save(r);
      // Autodate overwrites supplied values on insert. Preserve known legacy
      // dates only after the normal save; new events keep server timestamps.
      app.db().newQuery("UPDATE chore_messages SET created = {:at} WHERE id = {:id}")
        .bind({ at: at || a.getString("updated"), id: r.id }).execute();
    }
    if (a.getString("completed_at")) add("submitted", "", kid.getString("display_name"), "child", a.getString("completed_at"));
    if (a.getString("rejection_message")) add("legacy", a.getString("rejection_message"), "Parent", "parent");
    if (a.getString("kid_response")) add("legacy", a.getString("kid_response"), kid.getString("display_name"), "child");
    if (a.getString("status") === "approved") add("approved", a.getString("approval_comment"), "Parent", "parent", a.getString("approved_at"));
    else if (a.getString("status") === "rejected") add("rejected", "", "Parent", "parent");
  }
}, (app) => {
  if (app.findRecordsByFilter("chore_messages", "id != ''", "", 1).length) throw new Error("Conversation history must be preserved before rollback.");
  app.delete(app.findCollectionByNameOrId("chore_messages"));
  const a = app.findCollectionByNameOrId("assignments");
  a.fields.removeByName("submission_note"); a.fields.removeByName("thread_actor"); app.save(a);
});
