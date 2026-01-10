
import time
from playwright.sync_api import sync_playwright

def verify_sonar_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a large viewport to see the sonar clearly
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        try:
            # Navigate to the app
            page.goto("http://localhost:5173")

            # Wait for any text to indicate load
            page.wait_for_selector("text=SUB COMMAND", state="visible", timeout=5000)

            # Find the first scenario button (any button inside the grid)
            # The structure is button > h3

            # Click the first button found
            print("Clicking scenario...")
            page.locator("button").first.click()

            # Wait for main UI
            print("Waiting for game start...")
            page.wait_for_selector("text=Active Contacts", state="visible", timeout=10000)
            print("Game started!")

            # Allow some time for sonar data to accumulate on the waterfall
            print("Waiting for sonar history to accumulate...")
            time.sleep(5)

            # Take a screenshot of the whole page
            page.screenshot(path="/home/jules/verification/sonar_verification.png")
            print("Screenshot saved to /home/jules/verification/sonar_verification.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_sonar_display()
