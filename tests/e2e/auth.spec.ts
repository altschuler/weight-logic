import { test, expect } from "@playwright/test";
import { noOverflow, signIn } from "./helpers";

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

test("email code signs into the existing account inside an isolated home-screen app", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const original = await (
    await page.request.get("/api/auth/get-session")
  ).json();
  const app = await browser.newContext({
    baseURL: "http://localhost:5173",
    viewport: page.viewportSize()!,
  });
  await app.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  try {
    const installed = await app.newPage();
    await installed.goto("/");
    await installed.getByLabel("Email address").fill(original.user.email);
    await installed
      .getByRole("button", { name: "Email me a sign-in code" })
      .click();
    const code = await installed.locator(".local-mail code").innerText();
    const wrong = code === "000000" ? "111111" : "000000";
    await installed.getByLabel("Sign-in code", { exact: true }).fill(wrong);
    await installed.getByRole("button", { name: "Sign in with code" }).click();
    await expect(installed.getByRole("alert")).toBeVisible();
    await noOverflow(installed);
    await installed.getByLabel("Sign-in code", { exact: true }).clear();
    await installed.getByLabel("Sign-in code", { exact: true }).fill(code);
    await installed.getByRole("button", { name: "Sign in with code" }).click();
    await expect(installed.getByLabel("Journal date")).toBeVisible();
    await installed.reload();
    await expect(installed.getByLabel("Journal date")).toBeVisible();
    const session = await (
      await app.request.get("/api/auth/get-session")
    ).json();
    expect(session.user.id).toBe(original.user.id);
    await installed.getByRole("button", { name: "Sign out" }).click();
    const reused = await app.request.post("/api/auth/sign-in/email-otp", {
      headers: { Origin: "http://localhost:5173" },
      data: { email: original.user.email, otp: code },
    });
    expect(reused.ok()).toBe(false);
    expect(
      await (await app.request.get("/api/auth/get-session")).json(),
    ).toBeNull();
    expect(
      (await (await page.request.get("/api/auth/get-session")).json()).user.id,
    ).toBe(original.user.id);
  } finally {
    await app.close();
  }
});

test("email codes stop accepting guesses and a fresh code restores sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use an email code instead" }).click();
  await page
    .getByLabel("Email address")
    .fill(`code-${crypto.randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  const code = await page.locator(".local-mail code").innerText();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel("Sign-in code", { exact: true }).clear();
    await page
      .getByLabel("Sign-in code", { exact: true })
      .fill(code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Sign in with code" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await page.getByLabel("Sign-in code", { exact: true }).clear();
  await page.getByLabel("Sign-in code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page.getByRole("alert")).toContainText(/too many/i);
  await page.getByRole("button", { name: "Send a new code" }).click();
  const fresh = await page.locator(".local-mail code").innerText();
  await page.getByLabel("Sign-in code", { exact: true }).fill(fresh);
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page.getByLabel("Journal date")).toBeVisible();
});
