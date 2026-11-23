import { expect, test } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";

const url = process.env.PB_URL || "http://127.0.0.1:3111";

test("a parent confirms Deliver now for holiday time without changing the regular schedule", async ({ page }) => {
  const parent = new PaydirtClient(url), child = new PaydirtClient(url);
  await parent.login("parent1@test.local", "password123");
  await child.login("child1@test.local", "password123");
  const household = await parent.getHousehold(parent.currentUser!.household);
  const kid = await parent.pb.collection("users").getOne(child.currentUser!.id);
  const title = `Holiday override ${Date.now()}`;
  try {
    await parent.pb.collection("households").update(household.id, { grant_weekday_window: "none", grant_weekend_window: "none", grant_day_windows: "{}" });
    await parent.pb.collection("users").update(kid.id, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30), grant_weekday_window: "none", grant_weekend_window: "none", grant_day_windows: "{}" });
    const grant = await parent.giveBonusMinutes(kid.id, 15, title, `browser_override_${Date.now()}`);
    expect(grant.grant_status).toBe("queued");
    const before = await parent.getBalance(kid.id);
    await page.goto("/");
    await page.getByPlaceholder("Email").fill("parent1@test.local");
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const row = page.locator(".card.row").filter({ hasText: title });
    page.once("dialog", async (dialog) => { await dialog.dismiss(); });
    await row.getByRole("button", { name: "Deliver now", exact: true }).click();
    expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_window_override).toBe(false);
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("regular schedule stays the same");
      await dialog.accept();
    });
    await row.getByRole("button", { name: "Deliver now", exact: true }).click();
    await expect(row.getByRole("button", { name: "Delivery override enabled", exact: true })).toBeDisabled();
    const overridden = await parent.pb.collection("time_grants").getOne(grant.id);
    expect(overridden.grant_window_override).toBe(true);
    expect(overridden.grant_status).toBe("queued"); // No Google worker runs in this fixture.
    expect(await parent.getBalance(kid.id)).toBe(before);
    expect((await parent.getHousehold(household.id)).grant_weekday_window).toBe("none");
    await page.reload();
    await expect(page.locator(".card.row").filter({ hasText: title }).getByRole("button", { name: "Delivery override enabled", exact: true })).toBeDisabled();
  } finally {
    await parent.pb.collection("households").update(household.id, { grant_weekday_window: household.grant_weekday_window, grant_weekend_window: household.grant_weekend_window, grant_day_windows: household.grant_day_windows });
    await parent.pb.collection("users").update(kid.id, { fl_child_id: kid.fl_child_id, fl_device_id: kid.fl_device_id, grant_weekday_window: kid.grant_weekday_window, grant_weekend_window: kid.grant_weekend_window, grant_day_windows: kid.grant_day_windows });
  }
});
