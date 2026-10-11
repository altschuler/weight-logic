import { test, expect } from "@playwright/test";

test("magic link signs in, survives reload, cannot be reused, and signs out", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill(`auth-${crypto.randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const link = page.getByRole("link", { name: "Open local sign-in link" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page.getByLabel("Journal date")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Journal date")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.goto(href!);
  await expect(page.getByRole("alert")).toContainText("invalid or has expired");
});

test("a magic link can establish only one session under concurrent redemption", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill(`race-${crypto.randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const link = page.getByRole("link", { name: "Open local sign-in link" });
  await expect(link).toBeVisible();
  const url = (await link.getAttribute("href"))!;
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    await Promise.all(
      contexts.map((context) => context.request.get(url, { maxRedirects: 0 })),
    );
    const sessions = await Promise.all(
      contexts.map(async (context) =>
        (
          await context.request.get(
            "http://localhost:5173/api/auth/get-session",
          )
        ).json(),
      ),
    );
    expect(sessions.filter((session) => session?.user)).toHaveLength(1);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
