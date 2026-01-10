import { test, expect } from '@playwright/test';

test('verify sonar display loads without webgl errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('http://localhost:5173/');

  // Wait for the scenario select screen title "SUB COMMAND"
  await page.waitForSelector('h1:has-text("SUB COMMAND")');

  // Click the first scenario to enter the simulation
  await page.click('button:has-text("Safety of Navigation")');

  // Now wait for the Main Workspace
  // TopBar uses SIM TIME or HDG
  await page.waitForSelector('text=SIM TIME');

  // Sonar Display
  await page.waitForSelector('canvas');

  // Wait a bit for simulation to tick and WebGL to render frames
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'verification_sonar.png' });

  // Check for the specific WebGL error
  const webglError = consoleErrors.find(e => e.includes('ArrayBufferView not big enough'));
  if (webglError) {
    throw new Error(`Found WebGL Error: ${webglError}`);
  }
});
