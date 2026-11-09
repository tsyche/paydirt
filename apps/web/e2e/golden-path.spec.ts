import { test, expect, type Page } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";

// Parent dashboard golden path against a running, seeded PocketBase.
// The PaydirtClient plays the kid's part (completing the chore) and cleans up.

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";
const PW = "password123";
const REWARD = 7;

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

test("approve screen time, see the manual fallback, and confirm the grant", async ({ page }) => {
  const parent = new PaydirtClient(PB_URL);
  const kid = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", PW);
  await kid.login("child2@test.local", PW);
  const childId = kid.currentUser!.id;
  await parent.adjustBalance(childId, 100, "Screen-time E2E funds");
  const request = await kid.pb.collection("spend_requests").create({
    child: childId, amount: 15, description: `Screen-time E2E ${Date.now()}`, screen_minutes: 15,
  });
  try {
    await signIn(page);
    const row = page.locator(".card.row").filter({ hasText: request.description });
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(row).toContainText(/needs manual review/i);
    await expect(row).toContainText("Automatic grants are disabled");
    // The server result remains visible after a reload.
    await page.reload();
    await expect(row).toContainText(/needs manual review/i);
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Mark granted manually" }).click();
    await page.getByRole("region", { name: "Past screen-time grants" }).locator("summary").click();
    await expect(page.getByRole("region", { name: "Past screen-time grants" }).locator(".card").filter({ hasText: request.description })).toContainText("Granted manually");
    await expect(row).toHaveCount(0);
    expect((await parent.pb.collection("spend_requests").getOne(request.id)).grant_status).toBe("manual_done");
  } finally {
    // Keep the append-only ledger and cached balance consistent after cleanup.
    const saved = await parent.pb.collection("spend_requests").getOne(request.id);
    await parent.adjustBalance(childId, -100 + (saved.status === "approved" ? saved.amount : 0), "Screen-time E2E cleanup");
    const admin = new PaydirtClient(PB_URL).pb;
    await admin.collection("_superusers").authWithPassword(
      process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local",
      process.env.PB_ADMIN_PASSWORD ?? PW,
    );
    for (const tx of await admin.collection("currency_transactions").getFullList({
      filter: admin.filter("related_spend_request = {:id}", { id: request.id }),
    })) {
      await admin.collection("currency_transactions").update(tx.id, { related_spend_request: null });
    }
    await admin.collection("spend_requests").delete(request.id);
  }
});

test("create → assign → kid completes → approve → undo", async ({ page }) => {
  const choreName = `E2E chore ${Date.now()}`;
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kids = await api.listChildren(api.currentUser!.household);
  const kid1 = kids.find((k) => k.display_name === "Kid 1");
  expect(kid1).toBeDefined();

  page.on("dialog", (d) => void d.accept());
  await signIn(page);

  // Balance is "<number> <currencyName>" — parse the leading integer so a
  // renamed currency doesn't break the test. Kid cards live in the Kids tab.
  const kidBalance = page
    .locator(".card")
    .filter({ hasText: "Kid 1" })
    .locator(".kid-balance");
  const readBalance = async () => parseInt((await kidBalance.innerText()).trim(), 10);
  await goTab(page, /Kids/);
  const startBalance = await readBalance();

  // Create the chore (Chores tab). The create form is a `.card-filled` block.
  await goTab(page, /Chores/);
  await page.getByRole("button", { name: "Add a chore" }).click();
  await page.getByPlaceholder("New chore name").fill(choreName);
  const createCard = page
    .locator(".card-filled")
    .filter({ has: page.getByPlaceholder("New chore name") });
  await createCard.getByPlaceholder("Reward").fill(String(REWARD));
  await page.getByRole("button", { name: "Add chore" }).click();

  // Assign it to Kid 1
  const choreRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Assign" }) });
  await expect(choreRow).toBeVisible();
  await choreRow.getByRole("checkbox", { name: /Kid 1/ }).check();
  await choreRow.getByRole("button", { name: "Assign" }).click();

  // Kid completes it (via API — the kid app is mobile)
  let assignmentId = "";
  let choreId = "";
  await expect
    .poll(async () => {
      const list = await api.listAssignmentsForChild(kid1!.id);
      const match = list.find(
        (a) => (a as { expand?: { chore?: { name?: string } } }).expand?.chore?.name === choreName,
      );
      assignmentId = match?.id ?? "";
      choreId = match?.chore ?? "";
      return assignmentId;
    })
    .not.toBe("");
  await api.markComplete(assignmentId);

  // The dashboard retains its selected tab across reloads.
  await page.reload();
  await goTab(page, /Approvals/);
  const approvalRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Approve", exact: true }) });
  await expect(approvalRow).toBeVisible();
  await approvalRow.getByRole("button", { name: "Approve", exact: true }).click();
  await goTab(page, /Kids/);
  await expect.poll(readBalance).toBe(startBalance + REWARD);

  // Undo from "Recently approved" (Approvals tab) — balance must come back
  await goTab(page, /Approvals/);
  const undoRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Undo approval", exact: true }) });
  await expect(undoRow).toBeVisible();
  await undoRow.getByRole("button", { name: "Undo approval", exact: true }).click();
  await goTab(page, /Kids/);
  await expect.poll(readBalance).toBe(startBalance);

  // Cleanup: close out the assignment and retire the chore
  await api.rejectAssignment(assignmentId, "e2e cleanup");
  await api.deactivateChore(choreId);
});

test("a chore that pays time grants minutes on approval and can't be undone", async ({ page }) => {
  const choreName = `E2E time chore ${Date.now()}`;
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kids = await api.listChildren(api.currentUser!.household);
  const kid1 = kids.find((k) => k.display_name === "Kid 1");
  expect(kid1).toBeDefined();

  page.on("dialog", (d) => void d.accept());
  await signIn(page);

  // Create a chore that pays 10 minutes instead of bucks.
  await goTab(page, /Chores/);
  await page.getByRole("button", { name: "Add a chore" }).click();
  await page.getByPlaceholder("New chore name").fill(choreName);
  const createCard = page
    .locator(".card-filled")
    .filter({ has: page.getByPlaceholder("New chore name") });
  await createCard.getByLabel("Pay mode").selectOption("time");
  await expect(createCard.getByLabel("Reward")).toHaveCount(0);
  await createCard.getByLabel("Bonus minutes").fill("10");
  await page.getByRole("button", { name: "Add chore" }).click();

  const choreRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Assign" }) });
  await expect(choreRow).toBeVisible();
  await expect(choreRow).toContainText("10 min");
  await choreRow.getByRole("checkbox", { name: /Kid 1/ }).check();
  await choreRow.getByRole("button", { name: "Assign" }).click();

  let assignmentId = "";
  let choreId = "";
  await expect
    .poll(async () => {
      const list = await api.listAssignmentsForChild(kid1!.id);
      const match = list.find(
        (a) => (a as { expand?: { chore?: { name?: string } } }).expand?.chore?.name === choreName,
      );
      assignmentId = match?.id ?? "";
      choreId = match?.chore ?? "";
      return assignmentId;
    })
    .not.toBe("");
  await api.markComplete(assignmentId);

  await page.reload();
  await goTab(page, /Approvals/);
  const approvalRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Approve", exact: true }) });
  await expect(approvalRow).toBeVisible();
  await expect(approvalRow).toContainText("10 min");
  // Time approvals are irreversible: dismissing the confirm must not approve.
  let confirmText = "";
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => { confirmText = d.message(); void d.dismiss(); });
  await approvalRow.getByRole("button", { name: "Approve", exact: true }).click();
  expect(confirmText).toContain("can't be undone");
  expect(confirmText).toContain("10 min");
  await expect(approvalRow).toBeVisible();
  page.on("dialog", (d) => void d.accept());
  await approvalRow.getByRole("button", { name: "Approve", exact: true }).click();

  // A grant shows up under Screen-time grants, and the approved row has no Undo.
  const grantRow = page.locator(".card").filter({ hasText: `Chore: ${choreName} (10 min bonus)` });
  await expect(grantRow).toBeVisible();
  const approvedRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: /Send a reaction/ }) });
  await expect(approvedRow.getByRole("button", { name: "Undo approval", exact: true })).toHaveCount(0);

  // Cleanup: settle the manual grant and retire the chore.
  await grantRow.getByRole("button", { name: "Mark granted manually" }).click();
  await expect(grantRow).toContainText("Granted manually");
  await api.deactivateChore(choreId);
});

test("assigning past a chore's repeat limit asks first, and can be overridden", async ({ page }) => {
  const choreName = `E2E limit ${Date.now()}`;
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", PW);
  const kids = await api.listChildren(api.currentUser!.household);
  const kid1 = kids.find((k) => k.display_name === "Kid 1")!;
  const chore = await api.createChore({
    household: api.currentUser!.household,
    name: choreName,
    reward: 1,
    type: "recurring",
    cadence: "daily",
    max_per_period: 1,
    created_by: api.currentUser!.id,
    active: true,
  });
  const first = await api.assignChore(chore.id, kid1.id); // limit now reached
  // Approve it so Kid 1 is not "currently holding" the chore (that locks the checkbox); approved still counts toward the limit.
  await api.pb.collection("assignments").update(first.id, { status: "approved" });
  const count = async () =>
    (await api.pb.collection("assignments").getList(1, 1, { filter: api.pb.filter("chore = {:c}", { c: chore.id }) })).totalItems;
  try {
    await signIn(page);
    await goTab(page, /Chores/);
    const row = page
      .locator(".card.row")
      .filter({ hasText: choreName })
      .filter({ has: page.getByRole("button", { name: "Assign" }) });
    await row.getByRole("checkbox", { name: /Kid 1/ }).check();

    // Cancel: warned, nothing created.
    let message = "";
    page.once("dialog", (d) => { message = d.message(); void d.dismiss(); });
    await row.getByRole("button", { name: "Assign" }).click();
    await expect.poll(() => message).toContain("Assign anyway?");
    expect(message).toContain("1 per day");
    expect(message).toContain("Kid 1 (1 already)");
    expect(await count()).toBe(1);

    // Confirm: the parent override goes through.
    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Assign" }).click();
    await expect.poll(count).toBe(2);
  } finally {
    for (const a of await api.pb.collection("assignments").getFullList({ filter: api.pb.filter("chore = {:c}", { c: chore.id }) })) {
      await api.rejectAssignment(a.id, "e2e cleanup");
    }
    await api.deactivateChore(chore.id);
    void first;
  }
});

test("broadcast a message to all kids", async ({ page }) => {
  await signIn(page);
  await goTab(page, /Kids/);
  await page
    .getByPlaceholder("Message all kids (e.g. Dinner in 10 minutes!)")
    .fill("E2E broadcast test");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent to all kids 📣")).toBeVisible();

  // Archive this sender copy without deleting unrelated alerts.
  await goTab(page, /Alerts/);
  const row = page.locator(".card.row").filter({ hasText: "E2E broadcast test" }).first();
  const archive = row.getByRole("button", { name: /^Archive / });
  const label = await archive.getAttribute("aria-label");
  await archive.click();
  await expect(page.getByRole("status")).toContainText("Archived.");
  await page.getByRole("status").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: label!, exact: true }).first()).toBeVisible();
});
