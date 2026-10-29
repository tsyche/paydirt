/// <reference path="../pb_data/types.d.ts" />

// Pin down the built-in `avatar` file field on users so uploaded kid photos
// behave the same on every install: raster images only (no SVG: it can carry
// script), a 2 MB cap, and small thumbs for list/header use. Not protected:
// the apps load it with a plain <Image>/<img>, which can't send an auth token.
// The admin panel may already have changed this field by hand; this makes the
// config deterministic.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const avatar = users.fields.getByName("avatar");
    avatar.mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    avatar.maxSize = 2 * 1024 * 1024;
    avatar.thumbs = ["100x100", "300x300"];
    avatar.protected = false;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const avatar = users.fields.getByName("avatar");
    avatar.mimeTypes = ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"];
    avatar.maxSize = 0;
    avatar.thumbs = [];
    app.save(users);
  },
);
