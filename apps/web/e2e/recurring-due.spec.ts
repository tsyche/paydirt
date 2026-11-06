import { test, expect } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";
import { cleanupChores } from "../../../packages/shared/src/integration.cleanup";
const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";

test("recurring template prefill, create, edit, and immutable assignment deadline", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", "password123");
  const name = `Deadline browser ${Date.now()}`;
  const template = await api.createTemplate({ household: api.currentUser!.household, name, reward: 5, type: "recurring", cadence: "weekly", due_time: "20:00", due_day: 2 });
  const chores: string[] = [];
  try {
    await page.goto("/");
    await page.getByPlaceholder("Email").fill("parent1@test.local");
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("tab", { name: /Chores/ }).click();
    await page.getByRole("button", { name: /Templates \(/ }).click();
    await page.locator(".inline").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: "Use", exact: true }) }).last().getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByPlaceholder("New chore name")).toHaveValue(name);
    await expect(page.getByLabel("Recurring due time", { exact: false })).toHaveValue("20:00");
    await expect(page.getByLabel("Due weekday")).toHaveValue("2");
    await page.getByRole("button", { name: "Add chore", exact: true }).click();
    const row = page.locator(".chore-row").filter({ hasText: name });
    await expect(row).toBeVisible();
    const chore = (await api.listChores(api.currentUser!.household)).find((c) => c.name === name)!;
    chores.push(chore.id);
    expect(chore).toMatchObject({ cadence: "weekly", due_time: "20:00", due_day: 2 });
    const child = (await api.listChildren(api.currentUser!.household))[0]!;
    const assigned = await api.assignChore(chore.id, child.id);
    expect(new Date(assigned.due_at!).getTime()).toBeGreaterThan(Date.now());
    await row.getByRole("button", { name: "Edit chore", exact: true }).click();
    const editor = page.locator(".card-filled").filter({ has: page.getByPlaceholder("Chore name") });
    await editor.getByLabel("Recurring due time", { exact: false }).fill("21:00");
    await editor.getByLabel("Due weekday").selectOption("3");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(row).toBeVisible();
    expect(await api.pb.collection("chores").getOne(chore.id)).toMatchObject({ due_time: "21:00", due_day: 3 });
    expect((await api.pb.collection("assignments").getOne(assigned.id)).due_at).toBe(assigned.due_at);
    const next = await api.assignChore(chore.id, child.id);
    expect(next.due_at).not.toBe(assigned.due_at);
  } finally {
    // Find a partially created chore even if a browser assertion fails first.
    for (const c of await api.listChores(api.currentUser!.household)) if (c.name === name && !chores.includes(c.id)) chores.push(c.id);
    await cleanupChores(chores);
    await api.deleteTemplate(template.id);
  }
});
