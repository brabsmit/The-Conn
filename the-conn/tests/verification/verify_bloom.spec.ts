import { test, expect } from '@playwright/test';

test('verify sonar bloom effect', async ({ page }) => {
  // 1. Go to app
  await page.goto('http://localhost:5173');

  // 2. Select Scenario
  // Wait for the button
  const startButton = page.getByRole('button', { name: /Safety of Navigation/i });
  await expect(startButton).toBeVisible();
  await startButton.click();

  // 3. Wait for game to load
  // The TMA Display should appear. If not, maybe we are on WCS?
  // Let's wait for the "TMA" button in TopBar or the canvas itself.
  // The Sonar Display is always visible in the Left Pane (LeftPane.tsx)
  const sonar = page.getByTestId('sonar-display');
  await expect(sonar).toBeVisible({ timeout: 15000 });

  // 4. Wait for contacts to generate sonar data
  await page.waitForTimeout(5000);

  // 5. Take Screenshot
  await sonar.screenshot({ path: '/app/verification/sonar_bloom.png' });
});
