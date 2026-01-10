
import { test, expect } from '@playwright/test';

test('verify sonar grain', async ({ page }) => {
  // Go to app
  await page.goto('http://localhost:5173/');

  // Click scenario
  await page.click('button:has-text("Safety of Navigation")');

  // Wait for main UI
  await page.waitForSelector('canvas');

  // Wait for simulation to settle
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'verification/verification.png' });
});
