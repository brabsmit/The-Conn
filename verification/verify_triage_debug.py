
from playwright.sync_api import sync_playwright

def verify_range_triage():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load the application
        page.goto('http://localhost:5173/')

        # 2. Select a scenario (Scenario 1)
        page.wait_for_selector('text=SAFETY OF NAVIGATION')
        page.click('text=SAFETY OF NAVIGATION')

        # 3. Switch to NAV station
        page.click('text=NAV')

        # 4. Toggle Triage Display
        toggle_button = page.locator('button:has-text("SHOW TRIAGE")')
        toggle_button.click()

        # Small delay for React render
        page.wait_for_timeout(500)

        # 5. Take Screenshot
        page.screenshot(path='/home/jules/verification/range_triage_debug.png')
        print("Screenshot saved to /home/jules/verification/range_triage_debug.png")

        # 6. Check for text manually in print
        content = page.content()
        if "VELOCITY TRIAGE" in content:
            print("Found VELOCITY TRIAGE in DOM")
        else:
            print("VELOCITY TRIAGE NOT FOUND in DOM")

        browser.close()

if __name__ == "__main__":
    verify_range_triage()
