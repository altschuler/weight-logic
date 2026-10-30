import { test, expect } from "@playwright/test";
import { addDays, localToday } from "@weight-logic/domain";
import {
  addMeal,
  fixture,
  noOverflow,
  post,
  read,
  restore,
  signIn,
  weigh,
} from "./helpers";
import { readFile } from "node:fs/promises";

test("decimal commas save weights and meals and survive reload", async ({ page }) => {
  await signIn(page);
  await weigh(page, "morning", "79,2");
  await weigh(page, "evening", "79.7");
  await addMeal(page, "Lunch", "237,5");
  await page.reload();
  const saved = await read(page.request);
  expect(saved.days[0]).toMatchObject({ morning: "396/5", evening: "797/10" });
  expect(saved.days[0].meals[0].mass).toBe("475/2");
  await page.getByRole("button", { name: "Edit morning weight" }).click();
  await expect(page.getByLabel("Weight (kg)", { exact: true })).toHaveValue("79.2");
});

test("overlapping saves report busy and allow retry after the pending change", async ({
  page,
}) => {
  await signIn(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tracker", async (route) => {
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "Add morning weight" }).click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill("79.2");
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "A change is still saving. Please try again.",
  );
  const response = page.waitForResponse("**/api/tracker");
  release();
  await response;
  await page.unroute("**/api/tracker");
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await read(page.request)).days[0].morning).toBe("396/5");
});

test("a committed meal can be retried without duplication and saving keeps its editor open", async ({
  page,
}, info) => {
  await signIn(page);
  await weigh(page, "morning", "79.2");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tracker", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch(); // Commit the meal, but lose its successful response.
    await pending;
    await route.fulfill({
      status: 503,
      json: { error: "Response lost. Try again." },
    });
  });
  await page.getByRole("button", { name: "Add meal", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Meal name (optional)").fill("Lunch");
  await dialog.getByLabel("Food weight (g)").fill("237");
  await dialog.getByRole("button", { name: "Save meal" }).click();
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.mouse.click(0, 0);
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => (await read(page.request)).days[0].meals.length)
    .toBe(1);
  const committed = (await read(page.request)).days[0].meals[0];
  release();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Response lost. Try again.",
  );
  await expect(dialog.getByLabel("Food weight (g)")).toHaveValue("237");
  await page.unroute("**/api/tracker");
  await dialog.getByRole("button", { name: "Save meal" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await read(page.request)).days[0].meals).toEqual([committed]);
  await expect(
    page.getByRole("button", { name: "Add meal", exact: true }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Edit Lunch" }).click();
  let finish!: () => void;
  const saving = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/tracker", async (route) => {
    await saving;
    await route.continue();
  });
  await dialog.getByLabel("Food weight (g)").fill("241");
  await dialog.getByRole("button", { name: "Save meal" }).click();
  await expect(
    dialog.getByRole("button", { name: "Delete meal" }),
  ).toBeDisabled();
  await dialog.screenshot({
    path: `.amp/in/artifacts/saving-meal-${info.project.name}.png`,
  });
  finish();
  await expect(dialog).not.toBeVisible();
  expect((await read(page.request)).days[0].meals[0].mass).toBe("241");
});

test("meal presets fill an editable name and save preset or custom meals", async ({
  page,
}, info) => {
  await signIn(page);
  await weigh(page, "morning", "79.2");
  await page.getByRole("button", { name: "Add meal", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = dialog.getByLabel("Meal name (optional)");
  await expect(name).toHaveValue("");
  await dialog.screenshot({
    path: `.amp/in/artifacts/meal-empty-${info.project.name}.png`,
  });
  for (const preset of ["Snack", "Breakfast", "Lunch", "Dinner"]) {
    await dialog.getByRole("button", { name: preset, exact: true }).click();
    await expect(name).toHaveValue(preset);
    await expect(dialog.getByRole("button", { pressed: true })).toHaveText(
      preset,
    );
  }
  await page.mouse.move(0, 0);
  await dialog.screenshot({
    path: `.amp/in/artifacts/meal-preset-${info.project.name}.png`,
    animations: "disabled",
  });
  await page.getByLabel("Food weight (g)").fill("250");
  await page.getByRole("button", { name: "Save meal" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Add meal", exact: true }).click();
  await expect(name).toHaveValue("");
  await dialog.getByRole("button", { name: "Snack", exact: true }).click();
  await name.fill("Afternoon snack");
  await expect(dialog.getByRole("button", { pressed: true })).toHaveCount(0);
  await page.mouse.move(0, 0);
  await dialog.screenshot({
    path: `.amp/in/artifacts/meal-custom-${info.project.name}.png`,
    animations: "disabled",
  });
  await page.getByLabel("Food weight (g)").fill("120");
  await page.getByRole("button", { name: "Save meal" }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await read(page.request)).days[0].meals.map((meal) => meal.name),
  ).toEqual(["Dinner", "Afternoon snack"]);
});

test("onboarding previews a goal before committing and supports historical dates", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Create your first goal" }).click();
  await page.getByLabel("Starting weight (kg)").fill("82");
  await page.getByLabel("Target weight (kg)").fill("80");
  await page
    .getByLabel("Target date", { exact: true })
    .fill(addDays(localToday(), 10));
  await page.getByRole("button", { name: "Review goal", exact: true }).click();
  await expect(
    page.getByText("Fallback baseline · not a measurement"),
  ).toBeVisible();
  expect((await read(page.request)).goals).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm goal" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await read(page.request)).goals[0]).toMatchObject({
    activation: localToday(),
    start: "82",
    target: "80",
  });
  await page.getByRole("button", { name: "Previous day" }).click();
  await weigh(page, "evening", "81.6");
  await expect(page.getByTestId("remaining-budget")).toHaveText("—");
  await expect(
    page.getByRole("button", { name: "Add meal", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Change goal", exact: true }).click();
  await page.getByLabel("Target weight (kg)").fill("79");
  await page.getByRole("button", { name: "Review goal", exact: true }).click();
  await page.getByRole("button", { name: "Confirm goal" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = await read(page.request);
  expect(saved.goals).toHaveLength(1);
  expect(saved.goals[0].activation).toBe(localToday());
  expect(saved.days[0].date).toBe(addDays(localToday(), -1));
  await noOverflow(page);
});

test("worked meal accounting, corrections, acknowledgement, units and persistence", async ({
  page,
}, info) => {
  await signIn(page);
  await restore(page);
  await weigh(page, "morning", "79.2");
  await addMeal(page, "Breakfast", "250");
  await addMeal(page, "Lunch", "180");
  await expect(page.getByTestId("remaining-budget")).toHaveText("370g");
  await weigh(page, "evening", "79.7");
  await addMeal(page, "Evening snack", "120");
  await expect(page.getByTestId("remaining-budget")).toHaveText("180g");
  await expect(page.getByTestId("meal-total")).toHaveText("550 g");
  await noOverflow(page);
  await page.screenshot({
    path: `.amp/in/artifacts/journal-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByText("Calculation", { exact: true }).click();
  await expect(page.getByText("300 g", { exact: true })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Total" }).click();
  await expect(page.getByText("430 g", { exact: true })).toBeVisible();
  await page.getByText("Calculation", { exact: true }).click();
  await page.locator("summary").filter({ hasText: "Total" }).click();
  await page.getByRole("button", { name: "Dismiss for this day" }).click();
  await expect(
    page.getByRole("region", { name: "Plan reflection" }),
  ).not.toBeVisible();
  await weigh(page, "evening", "80.2");
  await expect(page.getByTestId("remaining-budget")).toHaveText("-320g");
  await expect(
    page.getByRole("region", { name: "Plan reflection" }),
  ).not.toBeVisible();
  await page.screenshot({
    path: `.amp/in/artifacts/negative-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit Breakfast" }).click();
  await page.getByLabel("Meal name (optional)").fill("Breakfast corrected");
  await page.getByRole("button", { name: "Save meal" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await read(page.request)).days[0].meals.find(
      (m) => m.name === "Breakfast corrected",
    )!.period,
  ).toBe("before");
  await page.getByRole("button", { name: "Edit evening weight" }).click();
  await page.getByRole("button", { name: "Remove weight" }).click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByTestId("remaining-budget")).toHaveText("250g");
  await page.reload();
  await expect(page.getByTestId("remaining-budget")).toHaveText("250g");
  const beforeUnits = await read(page.request);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Measurement units").selectOption("imperial");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  const afterUnits = await read(page.request);
  expect(afterUnits.days).toEqual(beforeUnits.days);
  expect(afterUnits.goals).toEqual(beforeUnits.goals);
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(page.getByTestId("remaining-budget")).toHaveText("8.8oz");
  await page.getByRole("button", { name: "Edit morning weight" }).click();
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await read(page.request)).days[0].morning).toBe("396/5");
  await page.getByRole("button", { name: "Edit morning weight" }).click();
  await page.getByRole("button", { name: "Remove weight" }).click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByTestId("remaining-budget")).toHaveText("—");
  await expect(page.getByText("Evening snack", { exact: true })).toBeVisible();
});

test("history, replan acceptance, backup roundtrip and rejected restore", async ({
  page,
}, info) => {
  await signIn(page);
  const today = localToday();
  await restore(page, {
    ...fixture(),
    goals: [
      {
        activation: addDays(today, -5),
        start: "82",
        target: "80",
        deadline: addDays(today, 5),
      },
    ],
  });
  await weigh(page, "morning", "81.7");
  await page.getByRole("button", { name: "Review your plan" }).click();
  await expect(page.getByText("Original plan’s fixed rate")).toBeVisible();
  await noOverflow(page);
  await page
    .getByRole("button", { name: "Accept replan" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Accept replan" }),
  ).toBeInViewport();
  await page.screenshot({
    path: `.amp/in/artifacts/replan-${info.project.name}.png`,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await read(page.request)).goals).toHaveLength(1);
  await page.getByRole("button", { name: "Review your plan" }).click();
  await page.getByRole("button", { name: "Accept replan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await read(page.request)).goals).toHaveLength(2);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page
    .getByLabel("Inspect planned weight on date")
    .fill(addDays(today, 1));
  await expect(page.getByTestId("projection-weight")).toHaveText("81.36 kg");
  await noOverflow(page);
  await page.screenshot({
    path: `.amp/in/artifacts/history-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByLabel("Inspect planned weight on date")
    .fill(addDays(today, 10));
  await expect(page.getByTestId("projection-weight")).toHaveText("80 kg");
  await page.locator("summary").filter({ hasText: "Recorded days" }).click();
  await page.getByRole("table").getByRole("button", { name: today }).click();
  await expect(page.getByLabel("Journal date")).toHaveValue(today);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    path: `.amp/in/artifacts/settings-${info.project.name}.png`,
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const original = JSON.parse(await readFile((await download.path())!, "utf8"));
  await page.getByLabel("Choose backup").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1}'),
  });
  await expect(page.getByRole("alert")).toContainText("not a valid");
  expect(await read(page.request)).toEqual(original);
  await page
    .getByRole("button", { name: "Delete journal data", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await read(page.request)).days).toHaveLength(0);
  await page.getByLabel("Choose backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  expect((await read(page.request)).days).toHaveLength(0);
  await page.getByRole("button", { name: "Replace with backup" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await read(page.request)).toEqual(original);
});

test("API isolates accounts, rejects cross-origin and invalid restores, and serializes writes", async ({
  page,
  browser,
  request,
}) => {
  expect((await request.get("/api/tracker")).status()).toBe(401);
  await signIn(page);
  await restore(page);
  const today = localToday();
  const operations = ["morning", "evening"].map((period, i) =>
    post(page.request, {
      type: "weight",
      date: today,
      period,
      value: i ? "79.7" : "79.2",
    }),
  );
  for (const response of await Promise.all(operations))
    expect(response.ok()).toBe(true);
  const saved = await read(page.request);
  expect(saved.days[0]).toMatchObject({ morning: "79.2", evening: "79.7" });
  const headers = {
    Origin: "http://localhost:5173",
    "X-Timezone": "Europe/Copenhagen",
  };
  expect((await page.request.put("/api/tracker", { headers })).status()).toBe(
    405,
  );
  for (const [data, requestHeaders, message] of [
    [
      "{}",
      { ...headers, "X-Timezone": "invalid" },
      "A valid timezone is required.",
    ],
    ["{", headers, "Invalid JSON."],
    [
      JSON.stringify({ type: "goal", target: "80", deadline: today }),
      headers,
      "Choose a target date after today.",
    ],
  ] as const) {
    const response = await page.request.post("/api/tracker", {
      headers: requestHeaders,
      data,
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: message });
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  const body = JSON.stringify({ type: "units", units: saved.units }).padEnd(
    1_600_000,
    " ",
  );
  expect(
    (await page.request.post("/api/tracker", { headers, data: body })).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/tracker", {
        headers,
        data: body.slice(0, -1) + "é",
      })
    ).status(),
  ).toBe(413);
  const oversized = {
    ...saved,
    days: [
      {
        ...saved.days[0],
        meals: [
          {
            id: "large",
            mass: "1",
            name: "é".repeat(755_000),
            period: "before",
            recordedAt: new Date().toISOString(),
          },
        ],
      },
    ],
  };
  const rejected = await post(page.request, {
    type: "restore",
    confirmed: true,
    data: oversized,
  });
  expect(rejected.status()).toBe(400);
  expect((await rejected.json()).error).toContain("1.5 MB storage limit");
  expect(
    (
      await post(page.request, {
        type: "restore",
        confirmed: true,
        data: { ...saved, days: [{ ...saved.days[0], morning: "-4" }] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(
        page.request,
        { type: "clear", confirmed: true },
        "https://evil.example",
      )
    ).status(),
  ).toBe(403);
  expect(await read(page.request)).toEqual(saved);
  const context = await browser.newContext({
    baseURL: "http://localhost:5173",
  });
  const other = await context.newPage();
  await signIn(other);
  expect((await read(other.request)).days).toHaveLength(0);
  const session = await (
    await page.request.get("/api/auth/get-session")
  ).json();
  const attack = await other.request.get(
    `/api/tracker?userId=${session.user.id}`,
  );
  expect((await attack.json()).days).toHaveLength(0);
  await context.close();
});

test("home-screen installation retains early offers and falls back after dismissal", async ({
  page,
}) => {
  await signIn(page);
  // Simulate the browser boundary, not a real OS installation dialog.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => ({ outcome: "dismissed" }) });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const install = page.getByRole("region", {
    name: "Install Weight Logic",
  });
  await install.getByRole("button", { name: "Install Weight Logic" }).click();
  await expect(install.getByText("iPhone or iPad:")).toBeVisible();
  await expect(install.getByText("Android:")).toBeVisible();
  await noOverflow(page);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(install.getByRole("status")).toContainText(
    "Weight Logic is installed",
  );
});
