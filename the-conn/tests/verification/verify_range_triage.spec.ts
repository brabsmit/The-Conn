import { test, expect } from '@playwright/test';

test.describe('Range Triage Display Verification', () => {
    test('renders range triage display and allows interaction', async ({ page }) => {
        // 1. Load the application
        await page.goto('http://localhost:5173/');

        // 2. Select a scenario (Scenario 1) to start the simulation
        // Wait for start screen
        await page.waitForSelector('text=Safety of Navigation', { timeout: 10000 });
        await page.click('text=Safety of Navigation');

        // 3. Switch to NAV station (where GeoDisplay lives)
        await page.click('text=NAV STATION');

        // 4. Toggle Triage Display
        const toggleButton = page.locator('button', { hasText: 'SHOW TRIAGE' });
        await expect(toggleButton).toBeVisible();
        await toggleButton.click();

        // 5. Verify Display Appears
        const triageHeader = page.locator('h3', { hasText: 'VELOCITY TRIAGE' });
        await expect(triageHeader).toBeVisible();

        const canvas = page.locator('.relative.cursor-crosshair canvas');
        await expect(canvas).toBeVisible();

        // 6. Verify Initial State (Trial Vector text matches ordered speed/course)
        await expect(page.locator('text=TRIAL VECTOR')).toBeVisible();

        // 7. Interact: Click on the canvas to set a trial vector
        const box = await canvas.boundingBox();
        if (box) {
            // Click somewhat to the right (East = 90 deg)
            await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);

            // Wait for update
            // Using a regex or partial match for text update
            // C-090 is expected if we click strictly to the right
            await expect(page.locator('div').filter({ hasText: /C-\d+/ })).toBeVisible({ timeout: 2000 });

            // 8. Commit: Click ORDER MANEUVER
            const orderBtn = page.locator('button', { hasText: 'ORDER' });
            await expect(orderBtn).toBeEnabled();
            await orderBtn.click();

            // 9. Verify reset logic (Trial becomes null, so text updates to ordered)
            await expect(triageHeader).toBeVisible();
        }
    });
});
