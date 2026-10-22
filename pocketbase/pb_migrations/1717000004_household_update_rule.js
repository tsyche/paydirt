/// <reference path="../pb_data/types.d.ts" />

// Parents must be able to update their own household's settings
// (currency name, bank threshold, quiet hours, streak bonuses...).
// 1717000001 only granted list+view; an empty update rule means
// superuser-only, so the web Settings save 403s with
// "Only superusers can perform this action."
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("households");
    c.updateRule = "@request.auth.role = 'parent' && @request.auth.household = id";
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("households");
    c.updateRule = null;
    app.save(c);
  },
);
