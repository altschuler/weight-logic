import { test, expect, devices } from "@playwright/test";

test("phones see installation instructions once, desktops do not", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Email address")).toBeVisible();
  const dialog = page.getByRole("dialog", {
    name: "Use Weight Logic as an app",
  });
  if (isMobile) {
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("iPhone or iPad:", { exact: false }),
    ).toBeVisible();
    await expect(dialog.getByText("Android:", { exact: false })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Got it" }).click();
  }
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(dialog).not.toBeVisible();
});

test("Android phones see only Android instructions", async ({ browser }) => {
  const context = await browser.newContext(devices["Pixel 7"]);
  try {
    const page = await context.newPage();
    await page.goto("http://localhost:5173/");
    const dialog = page.getByRole("dialog", {
      name: "Use Weight Logic as an app",
    });
    await expect(
      dialog.getByText("Tap the browser menu", { exact: false }),
    ).toBeVisible();
    await expect(dialog.getByText("Tap Share", { exact: false })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});

test("home-screen launches skip the installation popup", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Email me a sign-in code" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
