// PayDirt test-data seeder. Idempotent: re-running upserts the core records
// (household, users, chores) and only creates sample activity (assignments,
// spend requests, starting balances) when it's missing, so repeated runs
// don't pile up duplicates.
//
// Requires a RUNNING PocketBase (talks to the HTTP API). Run via `make seed`.
//
// Env overrides (all optional, defaults target local dev):
//   PB_URL            default http://127.0.0.1:8090
//   PB_ADMIN_EMAIL    default admin@paydirt.local
//   PB_ADMIN_PASSWORD default password123
//   SEED_PASSWORD     default password123  (shared by all seeded users)

import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "password123";
const PW = process.env.SEED_PASSWORD ?? "password123";

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

const log = (msg) => console.log(`  ${msg}`);

/** Find one record by filter, or null. */
async function findOne(collection, filter) {
  const list = await pb.collection(collection).getList(1, 1, { filter });
  return list.items[0] ?? null;
}

/** Upsert a user by email. Returns the record. */
async function upsertUser(email, data) {
  const existing = await findOne("users", pb.filter("email = {:e}", { e: email }));
  if (existing) {
    const updated = await pb.collection("users").update(existing.id, data);
    log(`user ${email} (updated)`);
    return updated;
  }
  const created = await pb.collection("users").create({
    email,
    password: PW,
    passwordConfirm: PW,
    emailVisibility: false,
    verified: true,
    ...data,
  });
  log(`user ${email} (created)`);
  return created;
}

/** Upsert a chore by household + name. Returns the record. */
async function upsertChore(household, name, data) {
  const existing = await findOne(
    "chores",
    pb.filter("household = {:h} && name = {:n}", { h: household, n: name }),
  );
  if (existing) {
    const updated = await pb.collection("chores").update(existing.id, data);
    log(`chore "${name}" (updated)`);
    return updated;
  }
  const created = await pb.collection("chores").create({
    household,
    name,
    active: true,
    ...data,
  });
  log(`chore "${name}" (created)`);
  return created;
}

/** Give a kid a starting balance via a manual_adjustment — but only if they
 *  have no transactions yet, so the cached balance and ledger stay consistent
 *  and re-runs don't keep topping them up. */
async function ensureStartingBalance(kid, amount) {
  const txns = await pb
    .collection("currency_transactions")
    .getList(1, 1, { filter: pb.filter("user = {:u}", { u: kid.id }) });
  if (txns.totalItems > 0) {
    log(`balance for ${kid.display_name} (skipped — ledger already has entries)`);
    return;
  }
  await pb.collection("currency_transactions").create({
    user: kid.id,
    amount,
    type: "manual_adjustment",
    reason: "Seed starting balance",
  });
  log(`balance for ${kid.display_name} (+${amount} via ledger)`);
}

/** Assign a chore to a kid only if no assignment exists for that pair. */
async function ensureAssignment(chore, kid, status = "assigned") {
  const existing = await findOne(
    "assignments",
    pb.filter("chore = {:c} && child = {:k}", { c: chore.id, k: kid.id }),
  );
  if (existing) {
    log(`assignment ${chore.name} -> ${kid.display_name} (exists)`);
    return existing;
  }
  const data = { chore: chore.id, child: kid.id, status };
  if (status === "completed") data.completed_at = new Date().toISOString();
  const created = await pb.collection("assignments").create(data);
  log(`assignment ${chore.name} -> ${kid.display_name} (${status})`);
  return created;
}

/** Create a pending spend request for a kid only if none pending exists. */
async function ensureSpendRequest(kid, amount, description) {
  const existing = await findOne(
    "spend_requests",
    pb.filter("child = {:k} && status = 'pending'", { k: kid.id }),
  );
  if (existing) {
    log(`spend request for ${kid.display_name} (pending one exists)`);
    return existing;
  }
  const created = await pb.collection("spend_requests").create({
    child: kid.id,
    amount,
    description,
    status: "pending",
  });
  log(`spend request for ${kid.display_name} ("${description}")`);
  return created;
}

async function main() {
  console.log(`Seeding PayDirt at ${PB_URL} ...`);
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  // Household
  let household = await findOne("households", pb.filter("name = {:n}", { n: "Test Family" }));
  if (!household) {
    household = await pb.collection("households").create({ name: "Test Family" });
    log(`household "Test Family" (created)`);
  } else {
    log(`household "Test Family" (exists)`);
  }
  const hh = household.id;

  // Users
  const parent = await upsertUser("parent@test.local", {
    role: "parent",
    display_name: "Parent",
    household: hh,
  });
  const kid1 = await upsertUser("child@test.local", {
    role: "child",
    display_name: "Kid 1",
    household: hh,
    simplified_mode: false,
  });
  const kid2 = await upsertUser("child2@test.local", {
    role: "child",
    display_name: "Kid 2",
    household: hh,
    simplified_mode: true,
  });

  // Chores
  const trash = await upsertChore(hh, "Take out trash", {
    description: "Kitchen + bathroom bins to the curb",
    reward: 25,
    type: "recurring",
    cadence: "weekly",
    created_by: parent.id,
  });
  const dishes = await upsertChore(hh, "Do the dishes", {
    description: "Load and run the dishwasher",
    reward: 15,
    type: "recurring",
    cadence: "daily",
    created_by: parent.id,
  });
  const room = await upsertChore(hh, "Clean your room", {
    description: "Floor clear, bed made",
    reward: 30,
    type: "oneoff",
    photo_required: true,
    created_by: parent.id,
  });

  // Starting balances (ledger-consistent, one-time)
  await ensureStartingBalance(kid1, 50);
  await ensureStartingBalance(kid2, 50);

  // Sample activity for the dashboard to show
  await ensureAssignment(trash, kid1, "assigned");
  await ensureAssignment(dishes, kid1, "completed"); // pending parent approval
  await ensureAssignment(room, kid2, "assigned");
  await ensureSpendRequest(kid2, 20, "30 min extra screen time");

  console.log("\nDone. Logins (all password: " + PW + "):");
  console.log("  admin@paydirt.local   (superuser)");
  console.log("  parent@test.local     (parent)");
  console.log("  child@test.local      (Kid 1)");
  console.log("  child2@test.local     (Kid 2)");
}

main().catch((err) => {
  console.error("\nSeed failed:", err?.message ?? err);
  if (err?.response) console.error(JSON.stringify(err.response, null, 2));
  process.exit(1);
});
