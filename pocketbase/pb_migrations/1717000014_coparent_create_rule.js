/// <reference path="../pb_data/types.d.ts" />

// Allow an authenticated parent to create a co-parent account in their own
// household. Rule enforces: caller must be a parent, new user's household must
// match caller's household, and new user's role must be "parent" — so parents
// can't self-promote kids or create accounts in other households.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("users");
    c.createRule =
      "@request.auth.role = 'parent' && @request.body.household = @request.auth.household && @request.body.role = 'parent'";
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("users");
    c.createRule = null;
    app.save(c);
  },
);
