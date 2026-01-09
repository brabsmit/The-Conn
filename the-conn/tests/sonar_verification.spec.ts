import { test, expect } from '@playwright/test';

test('verify sonar layout isolation and no crash', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');

    // Select a scenario to start the game
    await page.getByText('Tutorial: The Basics').click();
    await page.getByRole('button', { name: 'INITIALIZE SIMULATION' }).click();

    // Verify Sonar Array panel exists
    const sonarPanel = page.getByRole('heading', { name: 'Sonar Array' });
    await expect(sonarPanel).toBeVisible();

    // Wait for canvas to initialize
    await page.waitForTimeout(2000);

    // Initial Screenshot
    await page.screenshot({ path: '/home/jules/verification/sonar_initial.png' });

    // Check Dimensions of the Sonar Display container
    // We expect it to have style width/height set (locked)
    const sonarContainer = page.locator('.select-none[style*="width:"]');
    await expect(sonarContainer).toBeVisible();

    // Get initial dimensions
    const box = await sonarContainer.boundingBox();
    console.log(`Initial Box: ${box?.width}x${box?.height}`);

    // Now, add contacts to force "Contacts" panel to grow?
    // In Tutorial, we can maybe trigger something or manually inject contacts via console?
    // Let's use the debug scenario manager if available or just wait.
    // The instructions say "When you add the 4th contact...".
    // I can simulate this by injecting code or modifying DOM to expand the sibling panel.

    // Expand the sibling panel "Contacts" manually to simulate growth
    // "Contacts" panel is the second one in the left pane.
    // We can inject style to force it to grow.
    await page.evaluate(() => {
        const panels = document.querySelectorAll('.flex-grow.flex.flex-col.overflow-hidden');
        const contactPanel = panels[1]; // Should be contacts?
        if (contactPanel) {
            // Force it to be very tall
            (contactPanel as HTMLElement).style.height = '800px';
            // Or add content
            const div = document.createElement('div');
            div.style.height = '500px';
            div.innerText = 'EXPANSION';
            contactPanel.appendChild(div);
        }
    });

    // Wait a bit
    await page.waitForTimeout(1000);

    // Check if Sonar Container resized?
    // It should NOT resize if locked.
    const boxAfter = await sonarContainer.boundingBox();
    console.log(`After Box: ${boxAfter?.width}x${boxAfter?.height}`);

    expect(boxAfter?.width).toBeCloseTo(box!.width, 1);
    expect(boxAfter?.height).toBeCloseTo(box!.height, 1);

    // Final Screenshot
    await page.screenshot({ path: '/home/jules/verification/sonar_isolated.png' });
});
