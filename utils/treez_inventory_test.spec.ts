import { test, expect } from '@playwright/test';

test('Treez Inventory Login Test', async ({ page }) => {
  // 1. Navigate to the login URL
  await page.goto('https://login.dev.treez.io/');

  // 2. Define functionality to log in
  const email = process.env.TREEZ_USERNAME;
  const password = process.env.TREEZ_PASSWORD;

  if (!email || !password) {
    throw new Error('TREEZ_USERNAME and TREEZ_PASSWORD environment variables must be set');
  }

  // 3. Enter Email and Password
  await page.fill('#Email', email);
  await page.fill('#Password', password);

  // 4. Click Sign In
  await page.click('button:has-text("Sign in")');

  // 5. Verify Dashboard/Home Page Load
  console.log('Clicked Sign In. Waiting for navigation...');
  
  // Check for login error message
  const errorMsg = page.locator('.auth-error, .Mui-error').or(page.locator('text="Invalid username or password"'));
  if (await errorMsg.isVisible()) {
    throw new Error('Login failed: Invalid credentials or error message displayed.');
  }

  // Wait for navigation away from login
  await expect(page).not.toHaveURL(/login\.dev\.treez\.io/, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  console.log(`Current URL after login: ${page.url()}`);

  // 6. Verify Dashboard Elements
  // Verify Header is visible (more reliable than sidebar in some viewports)
  const header = page.locator('header, [role="banner"], .app-header').first();
  await expect(header).toBeVisible({ timeout: 15000 });

  // Verify Sidebar presence (might be hidden/collapsed)
  const sidebar = page.locator('nav.uicore-sidebar, .sidebar-wrapper, .main-menu').first(); 
  await expect(sidebar).toBeAttached({ timeout: 10000 }); // Check attached instead of visible if it starts hidden

  // Verify generic Home/Dashboard content
  await expect(page.locator('body')).toContainText(/Dashboard|Home|Welcome|Inventory/i);

  // 7. Visual Wait
  console.log('Verification passed. Waiting 10s for visual confirmation...');
  await page.waitForTimeout(10000);
});
