import { test, expect } from '@playwright/test';

test('magic link signs in, survives reload, cannot be reused, and signs out', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email address').fill(`auth-${crypto.randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  const link = page.getByRole('link', { name: 'Open local sign-in link' });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  await link.click();
  await expect(page.getByRole('heading', { name: 'Your journal' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your journal' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.goto(href!);
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');
});
