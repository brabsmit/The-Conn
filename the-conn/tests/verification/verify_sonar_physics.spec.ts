import { test, expect } from '@playwright/test';

// Run in headless mode to avoid XServer issues
test.use({ headless: true });

test('verify sonar environment noise and transmission loss', async ({ page }) => {
  // 1. Go to App
  await page.goto('http://localhost:5173/');

  // Wait for React to mount and scenario to load
  await page.waitForTimeout(3000);

  // Take a screenshot of the initial load state to debug
  await page.screenshot({ path: 'the-conn/tests/verification/debug_initial_load.png' });

  // 3. Start Scenario (Click the first button found)
  // Assuming ScenarioSelect is rendered
  const button = page.locator('button').first();
  // Check if button is visible before clicking
  if (await button.isVisible()) {
      await button.click();
  } else {
      console.log('No buttons found, maybe already in game?');
  }

  // 4. Ensure we are in Game
  await expect(page.getByText('TMA Controls')).toBeVisible({ timeout: 10000 });

  // --- TEST CASE 1: SPEED & NOISE ---
  // Default speed is 5kts.
  // Wait a bit to let sonar scroll
  await page.waitForTimeout(2000);

  // Take screenshot at low speed
  await page.screenshot({ path: 'the-conn/tests/verification/sonar_low_speed.png' });

  // Order Flank Speed (30kts)
  await page.evaluate(() => {
    // @ts-ignore
    if (window.useSubmarineStore) {
        window.useSubmarineStore.getState().setOrderedSpeed(30);
    }
  });

  // Force speed via store for verification speedup
  await page.evaluate(() => {
     // @ts-ignore
     if (window.useSubmarineStore) {
        window.useSubmarineStore.setState({ speed: 30 });
     }
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'the-conn/tests/verification/sonar_high_speed.png' });

  // --- TEST CASE 2: TRANSMISSION LOSS & CZ ---
  // Reset noise
  await page.evaluate(() => {
     // @ts-ignore
     if (window.useSubmarineStore) {
        window.useSubmarineStore.setState({ speed: 5, orderedSpeed: 5 });
     }
  });

  // Create a contact at 25000 yards (No CZ)
  // And one at 30000 yards (CZ)
  await page.evaluate(() => {
      // @ts-ignore
      if (window.useSubmarineStore) {
          const store = window.useSubmarineStore.getState();
          const ownX = store.x;
          const ownY = store.y;

          // Clear existing contacts
          store.contacts.forEach(c => store.removeContact(c.id));

          // Contact A: 25k yards North (Bearing 000)
          const distA = 25000 * 3; // feet
          const cA = {
              id: 'CONTACT_A',
              x: ownX,
              y: ownY + distA,
              heading: 180,
              speed: 5,
              classification: 'MERCHANT',
              sourceLevel: 10.0, // High SL
              status: 'ACTIVE'
          };

          // Contact B: 30k yards East (Bearing 090)
          const distB = 30000 * 3;
          const cB = {
              id: 'CONTACT_B',
              x: ownX + distB,
              y: ownY,
              heading: 270,
              speed: 5,
              classification: 'MERCHANT',
              sourceLevel: 10.0, // High SL
              status: 'ACTIVE'
          };

          store.addContact(cA);
          store.addContact(cB);
      }
  });

  await page.waitForTimeout(3000); // Let them paint
  await page.screenshot({ path: 'the-conn/tests/verification/sonar_cz_effect.png' });
});
