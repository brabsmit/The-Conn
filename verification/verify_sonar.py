
from playwright.sync_api import sync_playwright
import time

def verify_sonar_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use fixed viewport to ensure consistency
        page = browser.new_page(viewport={'width': 1280, 'height': 720})

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for app load
            print("Waiting for app to load...")
            page.wait_for_selector('body')
            time.sleep(2) # Give React time to hydrate

            # Click the correct scenario button
            print("Starting scenario 'Safety of Navigation'...")
            page.click('text="Safety of Navigation"')

            # Wait for main UI
            print("Waiting for Sonar Display...")
            page.wait_for_selector('[data-testid="sonar-display"]', timeout=10000)
            print("Sonar display found.")

            # Allow simulation to run for a few seconds to generate sonar history
            print("Running simulation for 5 seconds...")
            time.sleep(5)

            # Take screenshot of the sonar display specifically
            element = page.locator('[data-testid="sonar-display"]')
            print("Taking screenshot...")
            element.screenshot(path="verification/sonar_interpolation.png")
            print("Screenshot saved to verification/sonar_interpolation.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_sonar_display()
