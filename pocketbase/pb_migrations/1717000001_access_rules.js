/// <reference path="../pb_data/types.d.ts" />

// Household-scoped API access rules. Without these, collections are
// superuser-only and the parent/kid apps can't read or write anything.
//
// Conventions:
//   @request.auth.id        — logged-in user id
//   @request.auth.role      — "parent" | "child"
//   @request.auth.household — the user's household id
// Hook-created records (earn/spend transactions) run in app context and
// bypass these rules, so the ledger still fills regardless of create rules.

migrate(
  (app) => {
    const setRules = (name, rules) => {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = rules.list ?? null;
      c.viewRule = rules.view ?? null;
      c.createRule = rules.create ?? null;
      c.updateRule = rules.update ?? null;
      c.deleteRule = rules.delete ?? null;
      app.save(c);
    };

    const inHousehold = "@request.auth.household = household";
    const parentInHousehold =
      "@request.auth.role = 'parent' && @request.auth.household = household";

    setRules("households", {
      list: "@request.auth.household = id",
      view: "@request.auth.household = id",
    });

    setRules("users", {
      list: inHousehold,
      view: inHousehold,
      update:
        "@request.auth.id = id || (@request.auth.role = 'parent' && @request.auth.household = household)",
    });

    setRules("chores", {
      list: inHousehold,
      view: inHousehold,
      create: parentInHousehold,
      update: parentInHousehold,
      delete: parentInHousehold,
    });

    setRules("assignments", {
      list: "@request.auth.household = chore.household",
      view: "@request.auth.household = chore.household",
      create:
        "@request.auth.role = 'parent' && @request.auth.household = chore.household",
      // child may update own (mark complete); parent may update any in household.
      // A hook blocks non-parents from setting approved/rejected.
      update:
        "@request.auth.id = child || (@request.auth.role = 'parent' && @request.auth.household = chore.household)",
      delete:
        "@request.auth.role = 'parent' && @request.auth.household = chore.household",
    });

    setRules("spend_requests", {
      list: "@request.auth.household = child.household",
      view: "@request.auth.household = child.household",
      create: "@request.auth.id = child",
      // only parents resolve requests
      update:
        "@request.auth.role = 'parent' && @request.auth.household = child.household",
      delete:
        "@request.auth.role = 'parent' && @request.auth.household = child.household",
    });

    setRules("currency_transactions", {
      list: "@request.auth.id = user || (@request.auth.role = 'parent' && @request.auth.household = user.household)",
      view: "@request.auth.id = user || (@request.auth.role = 'parent' && @request.auth.household = user.household)",
      // direct creates = parent manual adjustments; hook creates bypass this
      create:
        "@request.auth.role = 'parent' && @request.auth.household = user.household",
    });
  },
  (app) => {
    for (const name of [
      "households",
      "users",
      "chores",
      "assignments",
      "spend_requests",
      "currency_transactions",
    ]) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = null;
      c.viewRule = null;
      c.createRule = null;
      c.updateRule = null;
      c.deleteRule = null;
      app.save(c);
    }
  },
);
