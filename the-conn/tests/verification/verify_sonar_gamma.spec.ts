import { test, expect } from '@playwright/test';

test('verify sonar gamma correction', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Debug: print all text on page
  // const bodyText = await page.locator('body').innerText();
  // console.log('Page Text:', bodyText);

  // The scenario select page should be visible
  await expect(page.locator('h1', { hasText: 'SUB COMMAND' })).toBeVisible({ timeout: 10000 });

  // Try to find the button for 'sc1' which is "Safety of Navigation"
  // It is rendered inside a button tag.
  // The structure is: <button>...<h3>Safety of Navigation</h3>...</button>
  const navScenarioBtn = page.getByRole('button').filter({ hasText: 'Safety of Navigation' });
  await expect(navScenarioBtn).toBeVisible({ timeout: 10000 });
  await navScenarioBtn.click();

  // Wait for canvas
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });

  // Wait for history
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'sonar_gamma_check.png', fullPage: true });
});
