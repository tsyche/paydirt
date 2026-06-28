import { test, expect, type Page } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";

// Phase 1 dashboard surfaces: kid chore proposals and approval reactions.
// Prereqs: running, seeded PocketBase (same as golden-path.spec.ts).

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PW = "password123";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("parent@test.local");
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
  await parent.login("parent@test.local", PW);
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
  await api.login("parent@test.local", PW);
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
