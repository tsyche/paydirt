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
  await expect(page.getByRole("heading", { name: "Kids" })).toBeVisible();
}

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
  // renamed currency doesn't break the test.
  const kidBalance = page
    .locator(".card")
    .filter({ hasText: "Kid 1" })
    .locator(".balance");
  const readBalance = async () => parseInt((await kidBalance.innerText()).trim(), 10);
  const startBalance = await readBalance();

  // Create the chore
  await page.getByPlaceholder("New chore name").fill(choreName);
  const createCard = page
    .locator(".card")
    .filter({ has: page.getByPlaceholder("New chore name") });
  await createCard.locator('input[type="number"]').fill(String(REWARD));
  await page.getByRole("button", { name: "Add chore" }).click();

  // Assign it to Kid 1
  const choreRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Assign" }) });
  await expect(choreRow).toBeVisible();
  await choreRow.getByRole("combobox").selectOption({ label: "Kid 1" });
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

  // Approve it in the dashboard
  await page.reload();
  const approvalRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Approve" }) });
  await expect(approvalRow).toBeVisible();
  await approvalRow.getByRole("button", { name: "Approve" }).click();
  await expect.poll(readBalance).toBe(startBalance + REWARD);

  // Undo from "Recently approved" — balance must come back
  const undoRow = page
    .locator(".card.row")
    .filter({ hasText: choreName })
    .filter({ has: page.getByRole("button", { name: "Undo" }) });
  await expect(undoRow).toBeVisible();
  await undoRow.getByRole("button", { name: "Undo" }).click();
  await expect.poll(readBalance).toBe(startBalance);

  // Cleanup: close out the assignment and retire the chore
  await api.rejectAssignment(assignmentId, "e2e cleanup");
  await api.deactivateChore(choreId);
});

test("broadcast a message to all kids", async ({ page }) => {
  await signIn(page);
  await page
    .getByPlaceholder("Message all kids (e.g. Dinner in 10 minutes!)")
    .fill("E2E broadcast test");
  await page.getByRole("button", { name: "📣 Send" }).click();
  await expect(page.getByText("Sent to all kids 📣")).toBeVisible();
});
