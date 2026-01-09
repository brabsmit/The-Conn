import { test, expect } from '@playwright/test';

test('verify sonar display loads without webgl errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('http://localhost:5173/');

  // Wait for the app to load
  await page.waitForSelector('h1:has-text("CONN")');

  // Navigate to Sonar Screen if not default (though layout suggests it's visible or part of a station)
  // Based on memories, SonarDisplay is a main component.
  // The layout has "Sonar" usually. Let's check for the Sonar Display element.
  // Memories say "SonarDisplay renders a 300-degree aperture".
  // Let's look for a canvas element which SonarDisplay uses.
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
