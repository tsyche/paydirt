import { test, expect, type Page } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";

// Parent dashboard golden path against a running, seeded PocketBase.
// The PaydirtClient plays the kid's part (completing the chore) and cleans up.

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PW = "password123";
const REWARD = 7;

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

test("create → assign → kid completes → approve → undo", async ({ page }) => {
  const choreName = `E2E chore ${Date.now()}`;
  const api = new PaydirtClient(PB_URL);
  await api.login("parent@test.local", PW);
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

  // Approve it in the dashboard (reload resets to the Approvals tab)
  await page.reload();
  const approvalRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Approve" }) });
  await expect(approvalRow).toBeVisible();
  await approvalRow.getByRole("button", { name: "Approve" }).click();
  await goTab(page, /Kids/);
  await expect.poll(readBalance).toBe(startBalance + REWARD);

  // Undo from "Recently approved" (Approvals tab) — balance must come back
  await goTab(page, /Approvals/);
  const undoRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Undo" }) });
  await expect(undoRow).toBeVisible();
  await undoRow.getByRole("button", { name: "Undo" }).click();
  await goTab(page, /Kids/);
  await expect.poll(readBalance).toBe(startBalance);

  // Cleanup: close out the assignment and retire the chore
  await api.rejectAssignment(assignmentId, "e2e cleanup");
  await api.deactivateChore(choreId);
});

test("broadcast a message to all kids", async ({ page }) => {
  await signIn(page);
  await goTab(page, /Kids/);
  await page
    .getByPlaceholder("Message all kids (e.g. Dinner in 10 minutes!)")
    .fill("E2E broadcast test");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent to all kids 📣")).toBeVisible();
});
