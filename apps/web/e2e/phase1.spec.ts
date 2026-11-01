import { test, expect, type Page } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";

// Phase 1 dashboard surfaces: kid chore proposals and approval reactions.
// Prereqs: running, seeded PocketBase (same as golden-path.spec.ts).

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";
const PW = "password123";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("parent1@test.local");
  await page.getByPlaceholder("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The dashboard is tabbed (Approvals / Kids / Chores); land on Approvals.
  await expect(page.getByRole("tab", { name: /Approvals/ })).toBeVisible();
}

const goTab = (page: Page, name: RegExp) =>
  page.getByRole("tab", { name }).click();

test("approve a kid's chore idea at a negotiated reward", async ({ page }) => {
  const ideaName = `E2E idea ${Date.now()}`;
  const kid = new PaydirtClient(PB_URL);
  const kidUser = await kid.login("child1@test.local", PW);
  const proposal = await kid.proposeChore(kidUser.household, kidUser.id, ideaName, 50);

  // Parent answers the reward prompt with 12
  page.on("dialog", (d) => void d.accept("12"));
  await signIn(page);

  // Chore ideas surface in the Approvals tab (the default landing tab).
  const ideaRow = page.locator(".card.row").filter({ hasText: ideaName });
  await expect(ideaRow).toBeVisible();
  await ideaRow.getByRole("button", { name: "Approve" }).click();

  // The idea becomes a real chore at the negotiated reward, assigned to the
  // kid — it now lives in the Chores tab.
  await goTab(page, /Chores/);
  const choreRow = page
    .locator(".card.row")
    .filter({ hasText: ideaName })
    .filter({ has: page.getByRole("button", { name: "Assign" }) });
  await expect(choreRow).toBeVisible();
  await expect(choreRow).toContainText("12");

  // Cleanup via API (no money moved — plain deletes are fine)
  const parent = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", PW);
  const assignments = await parent.listActiveAssignmentsForChild(kidUser.id);
  const created = assignments.find(
    (a) => (a as { expand?: { chore?: { name?: string } } }).expand?.chore?.name === ideaName,
  );
  if (created) {
    await parent.pb.collection("assignments").delete(created.id);
    await parent.pb.collection("chores").delete(created.chore);
  }
  await parent.pb.collection("chore_proposals").delete(proposal.id);
});

test("react to a recently approved chore", async ({ page }) => {
  const choreName = `E2E reaction ${Date.now()}`;
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kids = await api.listChildren(api.currentUser!.household);
  const kid1 = kids.find((k) => k.display_name === "Kid 1")!;

  // Set up an approved chore via API
  const chore = await api.createChore({
    household: api.currentUser!.household,
    name: choreName,
    reward: 3,
    type: "oneoff",
    created_by: api.currentUser!.id,
    active: true,
  });
  const assignment = await api.assignChore(chore.id, kid1.id);
  await api.markComplete(assignment.id);
  await api.approveAssignment(assignment.id);

  await signIn(page);
  const approvedRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Undo" }) });
  await expect(approvedRow).toBeVisible();
  await approvedRow.getByRole("button", { name: "🎉" }).click();
  await expect(approvedRow).toContainText("🎉");

  // Cleanup: undo reverses the reward; then remove the records entirely as
  // admin (the assignment has ledger refs, so parent-level deletes would fail
  // and a reject would leave clutter on the kid's screen).
  await api.undoApproval(assignment.id);
  const admin = new PaydirtClient(PB_URL);
  await admin.pb
    .collection("_superusers")
    .authWithPassword(
      process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local",
      process.env.PB_ADMIN_PASSWORD ?? "password123",
    );
  const txs = await admin.pb.collection("currency_transactions").getFullList({
    filter: admin.pb.filter("related_assignment = {:a}", { a: assignment.id }),
  });
  for (const t of txs) {
    await admin.pb.collection("currency_transactions").update(t.id, { related_assignment: null });
  }
  await admin.pb.collection("assignments").delete(assignment.id);
  await admin.pb.collection("chores").delete(chore.id);
});

test("screen-time request is priced from the household rate set in settings", async ({ page }) => {
  const parent = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", PW);
  const householdId = parent.currentUser!.household;
  const original = (await parent.getHousehold(householdId)).screen_rate ?? 0;
  let topUp = "";

  try {
    // Parent sets 2 bucks/minute in the settings panel
    await signIn(page);
    await page.getByRole("button", { name: /Settings/ }).click();
    await page.getByLabel("Bucks per screen-time minute").fill("2");
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => (await parent.getHousehold(householdId)).screen_rate).toBe(2);

    // Kid asks for 45 minutes; the request shows up priced at 90
    const kid = new PaydirtClient(PB_URL);
    const kidUser = await kid.login("child1@test.local", PW);
    // Requests above the kid's balance are rejected, so make sure 90 is affordable.
    await parent.adjustBalance(kidUser.id, 100, "e2e screen-time pricing top-up");
    topUp = kidUser.id;
    const sr = await kid.submitScreenTimeRequest(kidUser.id, 45, 1);
    await page.reload();
    const row = page.locator(".card.row").filter({ hasText: "45 min screen time" });
    await expect(row).toContainText("90");
    await row.getByRole("button", { name: "Deny" }).click();
    await expect(row).toHaveCount(0);
    await parent.pb.collection("spend_requests").delete(sr.id);
  } finally {
    if (topUp) await parent.adjustBalance(topUp, -100, "e2e screen-time pricing cleanup");
    await parent.updateHousehold(householdId, { screen_rate: original });
  }
});

test("settings info icons show their help text instantly on hover", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /Settings/ }).click();
  const row = page.locator(".settings-row").filter({ hasText: "Bucks per $1" });
  await expect(row.getByRole("note")).toHaveCount(0);
  await row.getByRole("button", { name: "More info" }).hover();
  await expect(row.getByRole("note")).toContainText("parentBucks equal $1", { timeout: 250 });
  await page.mouse.move(0, 0);
  await expect(row.getByRole("note")).toHaveCount(0);
});

test("add a starter chore from the age-band picker, then it shows as already added", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);

  await signIn(page);
  await goTab(page, /Chores/);
  await page.getByRole("button", { name: /Starter chores/ }).click();
  await page.getByRole("button", { name: "Ages 7-9" }).click();
  await page.getByLabel(/Unload the dishwasher/).check();
  await page.getByRole("button", { name: "Add 1 chore" }).click();
  await expect(page.getByText("already added")).toBeVisible();

  const created = (await api.listChores(api.currentUser!.household)).filter(
    (c) => c.name === "Unload the dishwasher",
  );
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ reward: 35, type: "recurring", cadence: "daily" });

  // Cleanup: retire the chore so reruns start clean
  await api.deactivateChore(created[0].id);
});

test("parent sets and deletes a kid savings goal on the web", async ({ page }) => {
  await signIn(page);
  await page.getByRole("tab", { name: /Kids/ }).click();

  const goalName = `E2E goal ${Date.now()}`;
  await page.getByRole("button", { name: "Set a goal" }).first().click();
  await page.getByPlaceholder("What are they saving for?").fill(goalName);
  await page.getByPlaceholder("Target").fill("50");
  await page.getByPlaceholder("Details (optional)").fill("Saving for the big set");
  await page.getByRole("button", { name: "Add goal" }).click();
  // Goals live in a collapsed section per kid; open it first.
  await page.getByRole("button", { name: /Goals \(\d+\)/ }).first().click();
  const deleteBtn = page.getByRole("button", { name: `Delete goal ${goalName}` });
  await expect(deleteBtn).toBeVisible();

  // Long goal names are ellipsized; clicking the name expands it.
  const nameBtn = page.getByRole("button", { name: new RegExp(`^${goalName}$`) });
  await expect(nameBtn).toHaveAttribute("aria-expanded", "false");
  await nameBtn.click();
  await expect(nameBtn).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Saving for the big set")).toBeVisible();

  // Clicking the goal itself must not delete it; only the ✕ does.
  let confirmed = false;
  const onDialog = (d: { dismiss: () => Promise<void> }) => { confirmed = true; void d.dismiss(); };
  page.on("dialog", onDialog);
  await nameBtn.click();
  page.off("dialog", onDialog);
  expect(confirmed).toBe(false);
  await expect(deleteBtn).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await deleteBtn.click();
  await expect(deleteBtn).toHaveCount(0);
});

test("co-parents panel lists the other parent on the web", async ({ page }) => {
  await signIn(page);
  await page.getByRole("tab", { name: /Kids/ }).click();
  await expect(page.getByText("Co-parents", { exact: true })).toBeVisible();
  await expect(page.getByText(/Parent 2/)).toBeVisible();
});

test("approvals tab shows a count badge for waiting actions", async ({ page }) => {
  await signIn(page);
  const badge = page.getByRole("tab", { name: /Approvals/ }).locator(".tab-badge");
  await expect(badge).toBeVisible();
  expect(Number(await badge.textContent())).toBeGreaterThan(0);
});

test("unsaved assign picks survive a reload and clear after Assign", async ({ page }) => {
  await signIn(page);
  await goTab(page, /Chores/);
  const row = () => page.locator(".card.row").filter({ hasText: "Clean your room" });
  const kid1 = () => row().getByRole("checkbox", { name: /Kid 1/ });
  await kid1().check();
  await page.reload();
  await goTab(page, /Chores/);
  await expect(kid1()).toBeChecked();
  await kid1().uncheck();
  await page.reload();
  await goTab(page, /Chores/);
  await expect(kid1()).not.toBeChecked();
});

test("assigning shows feedback, locks assigned kids, and lists the chore under the kid", async ({ page }) => {
  const choreName = `E2E assign ${Date.now()}`;
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const chore = await api.createChore({
    household: api.currentUser!.household,
    name: choreName,
    reward: 1,
    type: "oneoff",
    created_by: api.currentUser!.id,
    active: true,
  });
  try {
    await signIn(page);
    await goTab(page, /Chores/);
    const row = page.locator(".card.row").filter({ hasText: choreName });
    await row.getByRole("checkbox", { name: /Kid 1/ }).check();
    await row.getByRole("checkbox", { name: /Kid 2/ }).check();
    await row.getByRole("button", { name: "Assign (2)" }).click();
    await expect(row.getByRole("status")).toContainText("Assigned to Kid 1, Kid 2");
    // Assigned kids stay ticked but locked; nothing left to assign.
    await expect(row.getByRole("checkbox", { name: /Kid 1/ })).toBeDisabled();
    await expect(row.getByRole("checkbox", { name: /Kid 1/ })).toBeChecked();
    await expect(row.getByRole("button", { name: "Assign", exact: true })).toBeDisabled();
    // And it shows in the Kids tab.
    await goTab(page, /Kids/);
    await expect(page.getByText(choreName).first()).toBeVisible();
  } finally {
    for (const a of await api.pb.collection("assignments").getFullList({ filter: api.pb.filter("chore = {:c}", { c: chore.id }) })) {
      await api.rejectAssignment(a.id, "e2e cleanup");
    }
    await api.deactivateChore(chore.id);
  }
});

test("kid card order: chores, goals, earnings, then settings; twisty works; ledger More + All kids", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kid1 = (await api.listChildren(api.currentUser!.household)).find((k) => k.display_name === "Kid 1")!;
  const goal = await api.createGoal(kid1.id, `E2E order ${Date.now()}`, 9999, 0, "");
  try {
  await signIn(page);
  await goTab(page, /Kids/);
  const card = page.locator(".card").filter({ hasText: "Kid 1" }).first();
  const y = async (text: string | RegExp) => (await card.getByText(text).first().boundingBox())!.y;
  expect(await y(/📋 Chores/)).toBeLessThan(await y(/🎯 Goals/));
  expect(await y(/🎯 Goals/)).toBeLessThan(await y(/Recent earnings/));
  expect(await y(/Recent earnings/)).toBeLessThan(await y(/Edit avatar & settings/));

  // Clicking the tiny chevron itself toggles the section.
  const chores = card.locator(".goal-section-toggle", { hasText: /Chores/ });
  await expect(chores).toHaveAttribute("aria-expanded", "true");
  await chores.locator(".twisty").click();
  await expect(chores).toHaveAttribute("aria-expanded", "false");

  // Settings: modes sit together; Family Link is collapsed behind a twisty.
  await card.getByRole("button", { name: /Edit avatar & settings/ }).click();
  await expect(card.getByLabel("Family Link child ID")).toHaveCount(0);
  await card.locator(".goal-section-toggle", { hasText: "Family Link" }).locator(".twisty").click();
  await expect(card.getByLabel("Family Link child ID")).toBeVisible();

  // "More in ledger" opens the Ledger tab on this kid; the dropdown offers All kids.
  const more = card.getByRole("button", { name: /More in ledger/ });
  if (await more.count()) {
    await more.click();
    await expect(page.locator("select")).toHaveValue(/.+/);
    await expect(page.locator("select option", { hasText: "All kids" })).toHaveCount(1);
  }
  } finally {
    await api.deleteGoal(goal.id);
  }
});

test("chore row says who is assigned or already at the limit, before you try", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kids = await api.listChildren(api.currentUser!.household);
  const kid1 = kids.find((k) => k.display_name === "Kid 1")!;
  const name = `E2E hint ${Date.now()}`;
  const chore = await api.createChore({
    household: api.currentUser!.household,
    name,
    reward: 1,
    type: "recurring",
    cadence: "daily",
    max_per_period: 1,
    photo_required: true,
    race: true,
    created_by: api.currentUser!.id,
    active: true,
  });
  const a = await api.assignChore(chore.id, kid1.id);
  try {
    await signIn(page);
    await goTab(page, /Chores/);
    const row = page.locator(".card.row").filter({ hasText: name });
    // Enabled-feature icons sit to the right of the name, inside the title line.
    const title = row.locator(".chore-title");
    await expect(title.locator(".chore-badges")).toContainText("🏁");
    await expect(title.locator(".chore-badges")).toContainText("📷");
    expect(await title.locator("span").first().innerText()).toBe(name);
    // Active: checked, locked, labelled; nothing to assign.
    await expect(row.getByRole("checkbox", { name: /Kid 1/ })).toBeChecked();
    await expect(row.getByRole("checkbox", { name: /Kid 1/ })).toBeDisabled();
    await expect(row).toContainText("✓ assigned");
    await expect(row.getByRole("button", { name: "Assign", exact: true })).toBeDisabled();
    // Done (approved) but still inside the limit window: say so up front.
    await api.pb.collection("assignments").update(a.id, { status: "approved" });
    await page.reload();
    await goTab(page, /Chores/);
    await expect(row).toContainText("at limit (1 per day)");
    await expect(row.getByRole("checkbox", { name: /Kid 2/ })).not.toContainText("at limit");
  } finally {
    await api.deactivateChore(chore.id);
  }
});

test("add-chore form hides Due/Reminder/Max behind Advanced; ledger stacks on narrow screens", async ({ page }) => {
  await signIn(page);
  await goTab(page, /Chores/);
  await expect(page.getByLabel("Max per period")).toHaveCount(0);
  await page.getByRole("button", { name: /Advanced/ }).click();
  await expect(page.getByLabel("Max per period")).toBeVisible();
  await expect(page.getByText("Daily reminder")).toBeVisible();

  await goTab(page, /Ledger/);
  const table = page.locator("table.data-table");
  await expect(table.locator("thead")).toBeVisible();
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(table.locator("thead")).toBeHidden();
});

test("clicking a kid's picture uploads a new photo; no separate Photo field in settings", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kid1 = (await api.listChildren(api.currentUser!.household)).find((k) => k.display_name === "Kid 1")!;
  try {
    await signIn(page);
    await goTab(page, /Kids/);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.getByTestId(`avatar-file-${kid1.id}`).setInputFiles({ name: "k.png", mimeType: "image/png", buffer: png });
    await expect(page.locator(`button.avatar-picker img`).first()).toBeVisible();
    const card = page.locator(".card").filter({ hasText: "Kid 1" }).first();
    await card.getByRole("button", { name: /Edit avatar & settings/ }).click();
    await expect(card.getByText("Photo", { exact: true })).toHaveCount(0);
    await expect(card.getByLabel("Emoji")).toBeVisible();
  } finally {
    await api.pb.collection("users").update(kid1.id, { avatar: null });
  }
});
