
import asyncio
from playwright.async_api import async_playwright, expect

async def verify_sonar_update():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Navigate to the app
        await page.goto("http://localhost:5173")

        # Wait for the Sonar Display to be visible (canvas)
        await page.wait_for_selector("canvas")

        # Wait for simulation to run for a bit (10 seconds) to accumulate history
        # We want to see if history is being generated.
        print("Waiting for simulation to run...")
        await asyncio.sleep(10)

        # Take a screenshot
        await page.screenshot(path="verification/sonar_display.png")
        print("Screenshot taken.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_sonar_update())
