import { expect, test } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";

const url = process.env.PB_URL || "http://127.0.0.1:3111";

test("dollar bonuses and deductions use the kid override and preserve fractional grit", async ({ page }) => {
  const parent = new PaydirtClient(url);
  const child = new PaydirtClient(url);
  await parent.login("parent1@test.local", "password123");
  await child.login("child1@test.local", "password123");
  const kid = await parent.pb.collection("users").getOne(child.currentUser!.id);
  const household = await parent.getHousehold(parent.currentUser!.household);
  const initialBalance = kid.balance as number;
  const reason = `Dollar adjustment ${Date.now()}`;
  let netAdjustment = 0;
  try {
    await parent.pb.collection("households").update(household.id, { goods_rate: 88 });
    await parent.pb.collection("users").update(kid.id, { goods_rate: 44 });
    await page.goto("/");
    await page.getByPlaceholder("Email").fill("parent1@test.local");
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("tab", { name: /Kids/ }).click();
    const card = page.getByTestId(`kid-card-${kid.id}`);
    for (const [amount, delta] of [["2.50", 110], ["-2.49", -109.56]] as const) {
      await card.getByRole("button", { name: "Bonus / deduct", exact: true }).click();
      await card.getByRole("combobox", { name: "Amount unit" }).selectOption("dollars");
      await card.getByRole("spinbutton", { name: "Dollar amount" }).fill(amount);
      await card.getByPlaceholder("Reason", { exact: true }).fill(reason);
      await expect(card.getByRole("status")).toContainText(`${Math.abs(delta)} grit (44 grit per $1)`);
      await card.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(card.getByRole("button", { name: "Bonus / deduct", exact: true })).toBeVisible();
      netAdjustment += delta;
      expect(await parent.getBalance(kid.id)).toBeCloseTo(initialBalance + netAdjustment, 8);
    }
    const rows = await parent.listTransactions(kid.id);
    expect(rows.filter((row) => row.reason === reason).map((row) => row.amount).sort((a, b) => a - b)).toEqual([-109.56, 110]);
    await page.reload();
    await page.getByRole("tab", { name: /Kids/ }).click();
    await expect.poll(async () => parseFloat(await card.locator(".kid-balance").innerText())).toBeCloseTo(initialBalance + netAdjustment, 8);
  } finally {
    if (netAdjustment) await parent.adjustBalance(kid.id, -netAdjustment, "Restore dollar adjustment test balance");
    await parent.pb.collection("users").update(kid.id, { goods_rate: kid.goods_rate });
    await parent.pb.collection("households").update(household.id, { goods_rate: household.goods_rate });
  }
});
