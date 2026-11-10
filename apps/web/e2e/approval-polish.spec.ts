import { cleanupChores } from "../../../packages/shared/src/integration.cleanup";
import { test, expect, type Page } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";
import { completionFormWithPhoto } from "../../../packages/shared/src/integration.fixtures";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";
async function signIn(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("parent1@test.local");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Approvals/ })).toBeVisible();
}

test("resubmission context is labelled and partial credit opens below Approve without moving it", async ({ page }) => {
  const parent = new PaydirtClient(PB_URL);
  const kid = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", "password123");
  await kid.login("child1@test.local", "password123");
  const chore = await parent.createChore({
    household: parent.currentUser!.household, name: `E2E polish ${Date.now()}`, reward: 20,
    type: "oneoff", created_by: parent.currentUser!.id, active: true,
  });
  const assignment = await parent.assignChore(chore.id, kid.currentUser!.id);
  try {
    await kid.markComplete(assignment.id);
    await parent.rejectAssignment(assignment.id, "Please wipe the corners.");
    await kid.respondToRejection(assignment.id, "I wiped them again.");
    await kid.pb.collection("assignments").update(assignment.id, completionFormWithPhoto());
    await signIn(page);
    const row = page.locator(".card.row").filter({ hasText: chore.name });
    const context = row.getByRole("complementary", { name: "Resubmission details" });
    await expect(context).toContainText("Your previous feedback");
    await expect(context).toContainText("Please wipe the corners.");
    await expect(context).toContainText("Child’s reply");
    await expect(context).toContainText("I wiped them again.");
    const approve = row.getByRole("button", { name: "Approve", exact: true });
    const partial = row.locator("summary").filter({ hasText: "Partial credit" });
    const documentBox = () => approve.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + window.scrollX, y: box.y + window.scrollY, width: box.width, height: box.height };
    });
    const before = await documentBox();
    const partialBox = await partial.evaluate((element) => ({ y: element.getBoundingClientRect().y + window.scrollY }));
    expect(partialBox.y).toBeGreaterThanOrEqual(before.y + before.height);
    await partial.click();
    await expect(row.getByRole("spinbutton", { name: "Credit percent" })).toBeVisible();
    expect(await documentBox()).toEqual(before);
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Approve 50%", exact: true }).click();
    await expect(approve).toHaveCount(0);
    const record = await parent.pb.collection("assignments").getOne(assignment.id);
    expect(record.credit_percent).toBe(50);
  } finally {
    const record = await parent.pb.collection("assignments").getOne(assignment.id);
    if (record.status === "approved") await parent.undoApproval(assignment.id);
    await cleanupChores([chore.id]);
  }
});

test("archiving a settled chore supports Undo and Restore while keeping its payout", async ({ page }) => {
  const parent = new PaydirtClient(PB_URL);
  const kid = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", "password123");
  await kid.login("child1@test.local", "password123");
  const chore = await parent.createChore({
    household: parent.currentUser!.household, name: `E2E archive ${Date.now()}`, reward: 5,
    type: "oneoff", created_by: parent.currentUser!.id, active: true,
  });
  const assignment = await parent.assignChore(chore.id, kid.currentUser!.id);
  try {
    await kid.markComplete(assignment.id);
    await parent.approveAssignment(assignment.id);
    const balance = await parent.getBalance(kid.currentUser!.id);
    await signIn(page);
    const archive = page.getByRole("button", { name: `Archive ${chore.name}`, exact: true });
    await expect(page.locator(".card.row").filter({ has: archive })).toContainText(/\d{1,2}:\d{2}/);
    await page.route("**/api/collections/archives/records", (route) => route.request().method() === "POST"
      ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ status: 400, message: "Could not archive this item.", data: {} }) })
      : route.continue());
    await archive.click();
    await expect(page.getByRole("status")).toContainText("Could not archive this item.");
    await expect(archive).toBeVisible();
    await expect(archive).toBeEnabled();
    await page.unroute("**/api/collections/archives/records");
    await archive.click();
    await expect(archive).toHaveCount(0);
    await page.getByRole("status").getByRole("button", { name: "Undo", exact: true }).click();
    await expect(archive).toBeVisible();
    await archive.click();
    await expect(archive).toHaveCount(0);
    await page.getByRole("tab", { name: /Alerts/ }).click();
    await page.getByRole("button", { name: "Archived", exact: true }).click();
    const archived = page.getByRole("region", { name: "Archived items" }).locator(".card").filter({ hasText: chore.name });
    await archived.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(archived).toHaveCount(0);
    await page.getByRole("tab", { name: /Approvals/ }).click();
    await expect(archive).toBeVisible();
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(balance);
  } finally {
    await parent.undoApproval(assignment.id);
    await cleanupChores([chore.id]);
  }
});

test("a parent can restore a catalogue chore after archiving it", async ({ page }) => {
  const parent = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", "password123");
  const chore = await parent.createChore({
    household: parent.currentUser!.household, name: `E2E catalogue restore ${Date.now()}`, reward: 5,
    type: "oneoff", created_by: parent.currentUser!.id, active: true,
  });
  try {
    await signIn(page);
    await page.getByRole("tab", { name: /Chores/ }).click();
    const row = page.locator(".chore-row").filter({ hasText: chore.name });
    await row.getByRole("button", { name: "Edit chore" }).click();
    const editor = page.locator(".card-filled").filter({ has: page.getByRole("button", { name: "Save", exact: true }) });
    page.once("dialog", (dialog) => void dialog.accept());
    await editor.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(row).toHaveCount(0);

    const archived = page.locator("details.archived-chores");
    await expect(archived).toContainText("Archived chores");
    await archived.locator("summary").click();
    await archived.getByRole("button", { name: `Restore ${chore.name}`, exact: true }).click();
    await expect(page.locator(".chore-row").filter({ hasText: chore.name })).toBeVisible();
    await expect.poll(async () => (await parent.pb.collection("chores").getOne(chore.id)).active).toBe(true);
  } finally {
    await parent.pb.collection("chores").delete(chore.id);
  }
});

test("pending sections stay visible and past time starts collapsed above approved history", async ({ page }) => {
  const parent = new PaydirtClient(PB_URL);
  const kid = new PaydirtClient(PB_URL);
  await parent.login("parent1@test.local", "password123");
  await kid.login("child1@test.local", "password123");
  const description = `E2E past time ${Date.now()}`;
  const grant = await parent.giveBonusMinutes(kid.currentUser!.id, 5, description, `past_time_${Date.now()}`);
  try {
    await parent.confirmBonusGrant(grant.id);
    await signIn(page);
    await expect(page.getByRole("heading", { name: /Pending approvals/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pending screen-time grants", exact: true })).toBeVisible();
    const past = page.locator("details[aria-label='Past screen-time grants']");
    await expect(past).not.toHaveAttribute("open");
    await expect(past.getByText(description, { exact: false })).not.toBeVisible();
    const history = page.getByRole("heading", { name: /Recently approved/ });
    await expect(history).toBeVisible();
    expect((await past.boundingBox())!.y).toBeLessThan((await history.boundingBox())!.y);
    await past.locator("summary").click();
    await expect(past.getByText(description, { exact: false })).toBeVisible();
  } finally {
    const admin = new PaydirtClient(PB_URL);
    await admin.pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local", process.env.PB_ADMIN_PASSWORD ?? "password123");
    await admin.pb.collection("time_grants").delete(grant.id);
  }
});
