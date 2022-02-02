import { test, expect } from '@playwright/test';

test('Accept Age Gate - Valid', async ({ page }) => {
  // Go to https://dev.710labs.com/
  await page.goto('/');

  // Click text=I'm over 21 or a qualified patient
  await page.click("text=I'm over 21 or a qualified patient");

  // Click input[name="post_password"]
  const passwordField = await page.locator('input[name="post_password"]');
  await passwordField.click();
});

test('Accept Age Gate - Invalid', async ({ page }) => {
  // Go to https://dev.710labs.com/
  await page.goto('/');

  // Click text=I'm not 21 yet or don't qualify
  await page.click("text=I'm not 21 yet or don't qualify");

  //Assert Page Text
  await expect(page.locator('.age-gate-error-message')).toHaveText(
    'You are not old enough to view this content'
  );
});
