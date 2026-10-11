import { test, expect } from "@playwright/test";

test("installed apps detect updates and reload only on request", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.clock.install();
  let version: unknown = { version: "development" };
  await page.route("**/version.json", (route) =>
    route.fulfill({ json: version }),
  );
  await page.goto("/");
  const email = page.getByLabel("Email address");
  const reload = page.getByRole("button", { name: "Reload to update" });
  await expect(email).toBeVisible();
  await email.fill("unsaved@example.com");
  await expect(reload).not.toBeVisible();

  // A malformed response must not be mistaken for a newer build.
  version = {};
  await page.clock.runFor(5 * 60 * 1000);
  await expect(reload).not.toBeVisible();

  version = { version: "next-release" };
  await page.clock.runFor(5 * 60 * 1000);
  await expect(reload).toBeVisible();
  await expect(email).toHaveValue("unsaved@example.com");
  version = { version: "development" };
  await reload.click();
  await expect(email).toHaveValue("");
  await expect(reload).not.toBeVisible();
});

test("update checks recover from network failures when the app returns", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.clock.install();
  await page.route("**/version.json", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByLabel("Email address")).toBeVisible();
  const reload = page.getByRole("button", { name: "Reload to update" });
  await expect(reload).not.toBeVisible();
  await page.route("**/version.json", (route) =>
    route.fulfill({ json: { version: "next-release" } }),
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(reload).toBeVisible();
  await page.getByLabel("Email address").fill("unsaved@example.com");
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "App update" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(
    "unsaved@example.com",
  );
  await page.clock.runFor(5 * 60 * 1000);
  const sessionRefresh = page.waitForResponse("**/api/auth/get-session*");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await sessionRefresh;
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(reload).not.toBeVisible();
});
