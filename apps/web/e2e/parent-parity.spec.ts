import { test, expect } from "@playwright/test";
import { PaydirtClient } from "@paydirt/shared";
import { adminPb } from "../../../packages/shared/src/integration.cleanup";
const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("parent1@test.local");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Chores/ })).toBeVisible();
});

test("cancelled household edits reopen with saved values", async ({ page }) => {
  await page.getByRole("button", { name: /⚙️ Settings/ }).click();
  const group = page.locator(".settings-group").filter({ hasText: "Currency and reward defaults" });
  await group.locator("summary").click();
  const name = group.locator("input").first();
  const saved = await name.inputValue();
  await name.fill("Discard this draft");
  await page.locator(".settings-panel").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: /⚙️ Settings/ }).click();
  await group.locator("summary").click();
  await expect(name).toHaveValue(saved);
});

test("cancelled kid edits reopen with saved values", async ({ page }) => {
  await page.getByRole("tab", { name: /Kids/ }).click();
  await page.getByRole("button", { name: /Edit avatar & settings/ }).first().click();
  const emoji = page.getByRole("textbox", { name: "Emoji", exact: true });
  const saved = await emoji.inputValue();
  await emoji.fill("🐉");
  await page.locator(".kid-settings").getByRole("button", { name: "Cancel", exact: true }).first().click();
  await page.getByRole("button", { name: /Edit avatar & settings/ }).first().click();
  await expect(emoji).toHaveValue(saved);
});

test("template prefill clears a previous draft's absolute deadline", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", "password123");
  const name = `Parity template ${Date.now()}`;
  const template = await api.createTemplate({ household: api.currentUser!.household, name, reward: 5, type: "oneoff" });
  try {
    await page.getByRole("tab", { name: /Chores/ }).click();
    const form = page.locator(".chore-form");
    await form.getByRole("button", { name: "Add a chore" }).click();
    await form.getByRole("button", { name: /Advanced/ }).click();
    await form.getByLabel("Due", { exact: true }).fill("2027-03-18T16:45");
    await page.getByRole("button", { name: /Templates \(/ }).click();
    await page.locator(".inline").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: "Use", exact: true }) }).last().getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByPlaceholder("New chore name")).toHaveValue(name);
    if (!await form.getByLabel("Due", { exact: true }).isVisible()) await form.getByRole("button", { name: /Advanced/ }).click();
    await expect(form.getByLabel("Due", { exact: true })).toHaveValue("");
  } finally { await api.deleteTemplate(template.id); }
});

test("reviewing a kid idea clears unrelated draft restrictions", async ({ page }) => {
  const kid = new PaydirtClient(PB_URL);
  await kid.login("child1@test.local", "password123");
  const name = `Parity idea ${Date.now()}`;
  const proposal = await kid.proposeChore(kid.currentUser!.household, kid.currentUser!.id, name, 7);
  try {
    await page.getByRole("tab", { name: /Chores/ }).click();
    const form = page.locator(".chore-form");
    await form.getByRole("button", { name: "Add a chore" }).click();
    await form.getByLabel("Timer minutes", { exact: false }).fill("25");
    await form.getByLabel("Photo required", { exact: false }).check();
    await form.getByRole("button", { name: /Advanced/ }).click();
    await form.getByLabel("Due", { exact: true }).fill("2027-03-18T16:45");
    await page.getByRole("tab", { name: /Approvals/ }).click();
    const row = page.locator(".card.row").filter({ hasText: name });
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByPlaceholder("New chore name")).toHaveValue(name);
    await expect(form.getByLabel("Timer minutes", { exact: false })).toHaveValue("0");
    await expect(form.getByLabel("Photo required", { exact: false })).not.toBeChecked();
    await form.getByRole("button", { name: /Advanced/ }).click();
    await expect(form.getByLabel("Due", { exact: true })).toHaveValue("");
  } finally { await (await adminPb()).collection("chore_proposals").delete(proposal.id); }
});

test("expiry preview shows actual loss and saving does not expire the ledger", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", "password123");
  const admin = await adminPb();
  const hh = await api.getHousehold(api.currentUser!.household);
  const child = await admin.collection("users").create({ email: `preview-${Date.now()}@test.local`, password: "password123", passwordConfirm: "password123", household: hh.id, role: "child", display_name: "Browser expiry kid", verified: true });
  await admin.collection("currency_transactions").create({ user: child.id, type: "earn", amount: 100, reason: "Browser expiry preview" });
  try {
    await page.getByRole("button", { name: /⚙️ Settings/ }).click();
    const panel = page.locator(".settings-panel");
    await panel.getByText("Reward expiry and conversion", { exact: true }).click();
    let release!: () => void;
    const delay = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/collections/currency_transactions/records*", async (route) => { await delay; await route.continue(); });
    await panel.getByLabel("Rewards expire after days", { exact: true }).fill("0.000001");
    await expect(panel.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    release();
    await expect(panel.getByRole("status", { name: "Reward expiry preview" })).toContainText("Browser expiry kid: 100 Grit would expire today");
    await expect(panel.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    expect((await api.getHousehold(hh.id)).expiry_days).toBe(hh.expiry_days);
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel).not.toBeVisible();
    expect((await api.getHousehold(hh.id)).expiry_days).toBe(0.000001);
    expect(await api.getBalance(child.id)).toBe(100);
    expect((await api.listTransactions(child.id)).every((row) => !row.expiry_processed)).toBe(true);
  } finally {
    await api.updateHousehold(hh.id, { expiry_days: hh.expiry_days });
    for (const row of await admin.collection("currency_transactions").getFullList({ filter: admin.filter("user = {:id}", { id: child.id }) })) await admin.collection("currency_transactions").delete(row.id);
    await admin.collection("users").delete(child.id);
  }
});

test("pending delivery disappears when the foreground imports its worker receipt", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", "password123");
  const admin = await adminPb();
  const child = (await api.listChildren(api.currentUser!.household))[0]!;
  const hh = await api.getHousehold(api.currentUser!.household);
  const reason = `Browser fresh receipt ${Date.now()}`;
  try {
    await api.updateHousehold(hh.id, { grant_weekday_window: "", grant_weekend_window: "", grant_day_windows: "" });
    await api.pb.collection("users").update(child.id, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30), grant_weekday_window: "", grant_weekend_window: "", grant_day_windows: "" });
    const grant = await api.giveBonusMinutes(child.id, 15, reason, `browser_receipt_${Date.now()}`);
    const pending = page.locator(".card.row").filter({ hasText: reason });
    await expect(pending).toBeVisible();
    const imported = page.waitForResponse(async (response) => response.url().endsWith("/api/paydirt/grants/refresh") && response.status() === 200 && (await response.json()).changed > 0, { timeout: 12_000 });
    // This superuser fixture route exists only in the disposable browser backend.
    await admin.send(`/test/receipt/${grant.id}`, { method: "POST" });
    await imported;
    await expect(pending).not.toBeVisible();
    expect((await api.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("granted");
  } finally {
    await api.updateHousehold(hh.id, { grant_weekday_window: hh.grant_weekday_window, grant_weekend_window: hh.grant_weekend_window, grant_day_windows: hh.grant_day_windows });
    await api.pb.collection("users").update(child.id, { fl_child_id: child.fl_child_id ?? "", fl_device_id: child.fl_device_id ?? "", grant_weekday_window: child.grant_weekday_window ?? "", grant_weekend_window: child.grant_weekend_window ?? "", grant_day_windows: child.grant_day_windows ?? "" });
  }
});

test("web goal dollar entry uses the kid rate and rounds the Grit target up", async ({ page }) => {
  const api = new PaydirtClient(PB_URL);
  await api.login("parent1@test.local", "password123");
  const kid = (await api.listChildren(api.currentUser!.household))[0]!;
  const name = `Dollar goal parity ${Date.now()}`;
  try {
    await api.pb.collection("users").update(kid.id, { goods_rate: 44 });
    await page.getByRole("tab", { name: /Kids/ }).click();
    const card = page.getByTestId(`kid-card-${kid.id}`);
    await card.getByRole("button", { name: "Set a goal", exact: true }).click();
    await card.getByPlaceholder("What are they saving for?").fill(name);
    await card.getByRole("button", { name: "Enter target in dollars", exact: true }).click();
    await card.getByPlaceholder("Target ($)", { exact: true }).fill("12.51");
    await expect(card.getByRole("status").filter({ hasText: "551" })).toContainText("551 Grit");
    await card.getByRole("button", { name: "Add goal", exact: true }).click();
    await expect(card.getByRole("button", { name: "Set a goal", exact: true })).toBeVisible();
    expect((await api.listGoals(kid.id)).find((goal) => goal.name === name)?.target).toBe(551);
  } finally {
    const admin = await adminPb();
    for (const goal of await api.listGoals(kid.id)) if (goal.name === name) await admin.collection("savings_goals").delete(goal.id);
    await api.pb.collection("users").update(kid.id, { goods_rate: kid.goods_rate ?? 0 });
  }
});
