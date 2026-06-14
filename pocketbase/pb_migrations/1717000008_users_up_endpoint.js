/// <reference path="../pb_data/types.d.ts" />

// UnifiedPush endpoint per user. When the kid's app registers with ntfy (the
// UP distributor), the endpoint URL is stored here. PocketBase hooks POST to
// this URL instead of (or as a fallback from) the ntfy_topic.
// The endpoint URL encodes the ntfy server, so switching to a self-hosted
// instance only requires re-registration — no server-side config needed.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "up_endpoint" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.remove("up_endpoint");
    app.save(users);
  },
);
