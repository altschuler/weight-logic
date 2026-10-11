import { expect, type Page, type APIRequestContext } from "@playwright/test";
import {
  addDays,
  emptyDataset,
  localToday,
  type Dataset,
} from "@weight-logic/domain";

export async function signIn(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill(`journal-${crypto.randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("link", { name: "Open local sign-in link" }).click();
  await expect(page.getByLabel("Journal date")).toBeVisible();
}
export const post = (
  request: APIRequestContext,
  data: unknown,
  origin = "http://localhost:5173",
) =>
  request.post("/api/tracker", {
    data,
    headers: {
      Origin: origin,
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
export const read = async (request: APIRequestContext) => {
  const response = await request.get("/api/tracker");
  expect(response.ok()).toBe(true);
  return (await response.json()) as Dataset;
};
export const fixture = (): Dataset => ({
  ...emptyDataset(),
  goals: [
    {
      activation: addDays(localToday(), -10),
      start: "82",
      target: "80",
      deadline: localToday(),
    },
  ],
});
export async function restore(page: Page, data = fixture()) {
  const response = await post(page.request, {
    type: "restore",
    data,
    confirmed: true,
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Journal date")).toBeVisible();
}
export async function weigh(
  page: Page,
  period: "morning" | "evening",
  value: string,
) {
  await page
    .getByRole("button", { name: new RegExp(`^(Add|Edit) ${period} weight$`) })
    .click();
  await page.getByLabel("Weight (kg)", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
export async function addMeal(page: Page, name: string, mass: string) {
  await page.getByRole("button", { name: "Add meal", exact: true }).click();
  await page.getByLabel("Meal name (optional)").fill(name);
  await page.getByLabel("Food mass (g)").fill(mass);
  await page.getByRole("button", { name: "Save meal" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
export async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}
