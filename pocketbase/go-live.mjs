// PayDirt go-live onboarding: creates the real household, parents and kids on a
// FRESH (migrated, empty) PocketBase, with no seed data. Interactive.
//
// Refuses to run if any household already exists. Wipe first with
// `just host-reset` (the host) or `just reset-db` (local).
//
// Env (all optional; prompted when missing):
//   PB_URL             default http://127.0.0.1:3111
//   PB_ADMIN_EMAIL     default admin@paydirt.local
//   PB_ADMIN_PASSWORD  superuser password (prompted, hidden, if unset)

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import PocketBase from "pocketbase";
import { STARTER_BANDS } from "../packages/shared/src/starterChores.ts";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local";

let muted = false;
const rl = createInterface({
  input: process.stdin,
  output: new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  }),
  terminal: process.stdin.isTTY,
});

// Piped (non-TTY) input is read up front: readline closes before late questions.
const piped = process.stdin.isTTY ? null : readFileSync(0, "utf8").split("\n");
const readLine = (q) => (piped ? Promise.resolve(piped.shift() ?? "") : rl.question(q));

const ask = async (q, def = "") => {
  const a = (await readLine(def ? `${q} [${def}]: ` : `${q}: `)).trim();
  return a || def;
};
const askHidden = async (q) => {
  process.stdout.write(`${q}: `);
  muted = true;
  const a = await readLine("");
  muted = false;
  process.stdout.write("\n");
  return a;
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)
const genPassword = () =>
  Array.from(randomBytes(14), (b) => ALPHABET[b % ALPHABET.length]).join("");
// Topics on public ntfy.sh are world-readable by name, so make them unguessable.
const genTopic = () => `paydirt-${randomBytes(10).toString("hex")}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "") || "user";

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  console.log(`PayDirt go-live at ${PB_URL}\n`);
  const adminPw = process.env.PB_ADMIN_PASSWORD ?? (await askHidden(`Superuser password for ${ADMIN_EMAIL}`));
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, adminPw);

  const existing = await pb.collection("households").getList(1, 1);
  if (existing.totalItems > 0) {
    throw new Error("A household already exists. Wipe the database first (just host-reset / just reset-db).");
  }

  const householdName = await ask("Household name", "Our Family");
  const currency = await ask("Currency name (blank = app default)");
  const bandIds = STARTER_BANDS.map((b) => b.id).join(", ");
  let bands = [];
  for (;;) {
    bands = (await ask(`Starter chores by age band (${bandIds}; comma-separated, blank = none)`))
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    const unknown = bands.filter((b) => !STARTER_BANDS.some((x) => x.id === b));
    if (unknown.length === 0) break;
    console.log(`  Unknown age band(s): ${unknown.join(", ")}`);
    if (piped) throw new Error("Unknown age band in piped input.");
  }
  const household = await pb.collection("households").create({
    name: householdName,
    ...(currency ? { currency_name: currency } : {}),
  });

  const created = [];
  async function addUser(role, display_name, email, extra = {}) {
    const password = genPassword();
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      emailVisibility: false,
      verified: true,
      role,
      display_name,
      household: household.id,
      ntfy_topic: genTopic(),
      ...extra,
    });
    created.push({ role, display_name, email, password });
  }

  console.log("\nParents (blank name to finish):");
  for (;;) {
    const name = await ask("  Parent name");
    if (!name) break;
    await addUser("parent", name, await ask("  Email", `${slug(name)}@paydirt.local`));
  }
  if (created.length === 0) throw new Error("Add at least one parent.");

  console.log("\nKids (blank name to finish):");
  for (;;) {
    const name = await ask("  Kid name");
    if (!name) break;
    const email = await ask("  Login email", `${slug(name)}@paydirt.local`);
    const simple = (await ask("  Simplified UI (big buttons, icons)? y/n", "n")).toLowerCase().startsWith("y");
    await addUser("child", name, email, { simplified_mode: simple, calm_mode: false });
  }

  const firstParent = await pb.collection("users").getFirstListItem('role = "parent"');
  const seen = new Set();
  for (const band of STARTER_BANDS.filter((x) => bands.includes(x.id))) {
    for (const c of band.chores) {
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      await pb.collection("chores").create({
        household: household.id,
        name: c.name,
        description: c.description,
        reward: c.reward,
        type: c.type,
        ...(c.cadence ? { cadence: c.cadence } : {}),
        photo_required: c.photo_required ?? false,
        created_by: firstParent.id,
        active: true,
      });
    }
  }

  console.log(`\nCreated household "${householdName}". Logins (shown ONCE; change them in the app):\n`);
  for (const u of created) {
    console.log(`  ${u.role.padEnd(6)} ${u.display_name.padEnd(14)} ${u.email.padEnd(32)} ${u.password}`);
  }
  console.log(
    `\nCreated ${seen.size} starter chore(s).\nNext: sign in on each device and set each kid's Family Link child/device IDs in parent settings.`,
  );
}

main()
  .catch((e) => {
    console.error(`\nFailed: ${e.message ?? e}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
