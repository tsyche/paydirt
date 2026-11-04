/// <reference path="../pb_data/types.d.ts" />

// Free-text decline/deny reasons for the paths that lacked them, so the
// notification sent back to the kid carries why (chore rejects already had
// assignments.rejection_message; these add chore_proposals.decline_reason and
// spend_requests.decline_reason).
migrate(
  (app) => {
    const proposals = app.findCollectionByNameOrId("chore_proposals");
    if (!proposals.fields.getByName("decline_reason")) {
      proposals.fields.add(new TextField({ name: "decline_reason", required: false }));
      app.save(proposals);
    }
    const spends = app.findCollectionByNameOrId("spend_requests");
    if (!spends.fields.getByName("decline_reason")) {
      spends.fields.add(new TextField({ name: "decline_reason", required: false }));
      app.save(spends);
    }
  },
  (app) => {
    const proposals = app.findCollectionByNameOrId("chore_proposals");
    proposals.fields.removeByName("decline_reason");
    app.save(proposals);
    const spends = app.findCollectionByNameOrId("spend_requests");
    spends.fields.removeByName("decline_reason");
    app.save(spends);
  },
);
