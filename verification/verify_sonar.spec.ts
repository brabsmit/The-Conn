import { test, expect } from '@playwright/test';

test('verify sonar header', async ({ page }) => {
  await page.goto('http://localhost:5173');
  // Wait for application to load
  await page.waitForSelector('canvas', { timeout: 30000 });

  // Click 'Scenario Select' if needed.
  // Based on memory, app starts in MENU.
  // Let's try to find a button to start.
  // Using generic wait for text if specific button is unknown.

  const startButton = page.locator('button').filter({ hasText: 'Ambush' });
  if (await startButton.isVisible()) {
      await startButton.click();
  } else {
      // Maybe 'Load Scenario'?
      const loadBtn = page.locator('button').filter({ hasText: 'Load' }).first();
      if (await loadBtn.isVisible()) {
          await loadBtn.click();
      }
  }

  // Wait for Sonar Display
  // The sonar display has a canvas.
  // We want to see the header.
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'verification/sonar_header.png' });
});
