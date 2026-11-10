import { expect, test } from "@playwright/test";
import { PaydirtClient, timeBankTotals } from "@paydirt/shared";

const url = process.env.PB_URL || "http://127.0.0.1:3111";

test("parent summary and detail update when a kid earns, reserves, and delivers saved time", async ({ page }) => {
  const parent = new PaydirtClient(url);
  const kid = new PaydirtClient(url);
  await parent.login("parent1@test.local", "password123");
  await kid.login("child1@test.local", "password123");
  const child = kid.currentUser!.id;
  const initial = await kid.getTimeBank(child);
  const before = timeBankTotals(initial.ledger, initial.grants, initial.purchases);
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("parent1@test.local");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Kids/ }).click();
  const card = page.getByTestId(`kid-card-${child}`);
  const bank = card.getByRole("region", { name: "Saved earned time" });
  const bankSummary = bank.locator("summary").first();
  await expect(bankSummary).toHaveText(`Banked time: ${before.available} min`);
  await expect(bank.getByText(/\d+ min reserved for review/)).not.toBeVisible();
  await bankSummary.click();
  await expect(bank).toContainText(`${before.available} min saved`);
  const summaryLabels = ["min saved", "min reserved for review", "min requested", "min queued"];
  const positions = await Promise.all(summaryLabels.map((label) => bank.getByText(new RegExp(`\\d+ ${label}`)).first().evaluate((element) => element.getBoundingClientRect().top)));
  for (let i = 1; i < positions.length; i++) expect(positions[i]!).toBeGreaterThan(positions[i - 1]!);
  const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Saved-time browser proof", reward: 0,
    type: "oneoff", created_by: parent.currentUser!.id, active: true, pay_mode: "time", reward_minutes: 30 });
  const assignment = await parent.assignChore(chore.id, child);
  await kid.markComplete(assignment.id);
  await parent.approveAssignment(assignment.id);
  await expect(bank).toContainText(`${before.available + 30} min saved`);
  await expect(bank.getByText("Earned-time history", { exact: true })).toBeVisible();
  await expect(bank).toContainText("Earned");
  const redemption = await kid.redeemSavedTime(15, `browser_${Date.now()}`, true);
  await expect(bank).toContainText(`${before.available + 15} min saved`);
  // This fixture disables automation; a parent can confirm manual delivery.
  await expect(bank).toContainText(`${before.reserved + 15} min reserved for review`);
  const grant = (await kid.getTimeBank(child)).grants.find((g) => g.redemption === redemption.id)!;
  await parent.confirmBonusGrant(grant.id);
  await expect(bank).toContainText(`${before.available + 15} min saved`);
  await expect(bank).toContainText(`${before.reserved} min reserved for review`);
  await expect(bank).toContainText("Delivered");
  await page.reload();
  const reloaded = page.getByTestId(`kid-card-${child}`).getByRole("region", { name: "Saved earned time" });
  await expect(reloaded.locator("summary")).toHaveText(`Banked time: ${before.available + 15} min`);
  await expect(reloaded.getByText(/\d+ min reserved for review/)).not.toBeVisible();
});
