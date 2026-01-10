
import asyncio
from playwright.async_api import async_playwright, expect

async def verify_pep_display():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        print("Navigating to app...")
        await page.goto("http://localhost:5173")

        print("Waiting for scenario buttons...")
        await expect(page.get_by_text("SUB COMMAND")).to_be_visible(timeout=10000)

        print("Starting scenario...")
        await page.locator("button").first.click()

        print("Waiting for TopBar...")
        await expect(page.get_by_text("TIMESCALE")).to_be_visible(timeout=10000)

        print("Scenario loaded.")

        # Open DEV menu
        print("Opening Scenario Manager...")
        await page.get_by_text("DEV").click()
        await expect(page.get_by_text("Scenario Manager")).to_be_visible()

        # Add a Contact to ensure we have something to track
        print("Adding Contact...")
        await page.get_by_text("+ ADD CONTACT").click()

        # Close Manager
        await page.get_by_text("✕").click()

        # Now wait for the contact to be detected and tracker created.
        # This depends on simulation speed.
        # Let's speed up sim.
        # Click [5X] or [FAST] (actually labeled FAST/MED/SLOW in TopBar)
        try:
             await page.get_by_text("FAST").click()
             print("Set Time Scale to FAST")
        except:
             pass

        print("Waiting for Tracker S-")
        # Tracker IDs from Scenario Manager start with S-.
        # Wait for "S-" text in the Contact List (left panel).
        try:
             await expect(page.locator("text=/S-\\d+/").first).to_be_visible(timeout=20000)
        except:
             print("Tracker not appearing yet. Waiting more...")
             await page.wait_for_timeout(5000)

        # Try to find any tracker ID
        trackers = page.locator("div[class*='ContactListRow']").all() # Guessing class or similar structure
        # Or just look for text starting with S

        # Let's blindly click on the first contact in list if it exists.
        # Usually list is on left.

        # Let's try to click a text that looks like a tracker ID (e.g. S-17...)
        # Regex locator
        tracker_locator = page.locator("text=/^S-\\d+/").first
        if await tracker_locator.count() > 0:
             await tracker_locator.click()
             print("Clicked a tracker")
        else:
             print("No tracker found to click.")
             await page.screenshot(path="verification/no_tracker.png")
             # Try to proceed anyway if PEP is openable without selection? (Usually not)

        # Look for PEP button
        print("Looking for PEP button...")
        try:
            # It might be an overlay button on the TMA display
            # Or in the tools panel.
            await page.get_by_text("PEP").click()
            print("Clicked PEP")
        except:
             print("PEP text not found.")

        await page.wait_for_timeout(3000)

        print("Taking screenshot...")
        await page.screenshot(path="verification/pep_verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_pep_display())
