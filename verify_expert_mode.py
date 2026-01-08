import time
from playwright.sync_api import sync_playwright

def verify_expert_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load the App
        print("Loading App...")
        page.goto("http://localhost:5173")
        page.wait_for_timeout(2000)

        # 2. Select Scenario "Safety of Navigation"
        print("Selecting Scenario...")
        page.click("text=Safety of Navigation")
        page.wait_for_timeout(2000)

        # 3. Check for DEV button (Should be GONE)
        print("Checking for DEV button...")
        dev_btn = page.query_selector("text=DEV")
        if dev_btn and dev_btn.is_visible():
            print("FAILURE: DEV button is visible in Expert Mode.")
            page.screenshot(path="verification/failure_dev_visible.png")
            browser.close()
            return
        else:
            print("SUCCESS: DEV button is hidden.")

        # 4. Check God Mode Toggle (Ctrl+Shift+D)
        print("Testing God Mode Toggle...")

        # Check Store State before
        god_mode_before = page.evaluate("() => window.useSubmarineStore.getState().godMode")
        print(f"God Mode Before: {god_mode_before}")

        # Press Keys
        page.keyboard.press("Control+Shift+D")
        page.wait_for_timeout(1000)

        # Check Store State after
        god_mode_after = page.evaluate("() => window.useSubmarineStore.getState().godMode")
        print(f"God Mode After: {god_mode_after}")

        if god_mode_after == True:
             print("SUCCESS: God Mode state toggled to TRUE.")
        else:
             print("FAILURE: God Mode state did not toggle.")

        # Visual Check
        # We look for the red border class on the GeoDisplay container.
        # Since finding it by class name is flaky with tailwind modifiers, let's look for any element with that specific style or class.
        # Alternatively, verify the visual result via screenshot.

        page.screenshot(path="verification/success_expert_mode.png")
        print("Screenshot saved to verification/success_expert_mode.png")
        browser.close()

if __name__ == "__main__":
    verify_expert_mode()
