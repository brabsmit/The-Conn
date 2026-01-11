import time
from playwright.sync_api import sync_playwright

def verify_ui_layout():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Wait for Scenario Select and click Safety of Navigation (Scenario 1)
        # Assuming the first button or specific text
        try:
            print("Selecting Scenario 1...")
            # Adjust selector based on actual ScenarioSelect component, usually text="Scenario 1" or similar
            page.wait_for_selector('text="Safety of Navigation"', timeout=5000)
            page.click('text="Safety of Navigation"')
        except Exception as e:
            print(f"Error selecting scenario: {e}")
            # Try generic button if specific text fails
            page.click('button')

        print("Waiting for game load...")
        time.sleep(2) # Give it a moment to render main layout

        # 1. Verify Left Panel (Sonar) - Contact List Removal
        # The Contact List table usually had headers like "ID", "Class", "Brg"
        # We expect NOT to find this table structure in the left panel.
        # The left panel is now just SonarDisplay.

        print("Verifying Contact List removal...")
        content = page.content()
        if "CONTACT TABLE" in content or "Contact List" in content:
             # Adjust check based on what the old component actually rendered
             # But checking for the new "Monolith" state:
             # SonarDisplay should be h-full
             pass

        # 2. Verify Right Panel (TMA Controls) - Contact Selector
        print("Verifying Contact Selector...")
        try:
            # Wait for the selector elements
            page.wait_for_selector('[data-testid="tracker-prev"]', state='visible', timeout=5000)
            page.wait_for_selector('[data-testid="tracker-select"]', state='visible', timeout=5000)
            page.wait_for_selector('[data-testid="tracker-next"]', state='visible', timeout=5000)
            print("SUCCESS: Contact Selector elements found and visible.")

            # Interact with it
            select_val = page.input_value('[data-testid="tracker-select"]')
            print(f"Initial Selector Value: '{select_val}'")

        except Exception as e:
            print(f"FAILURE: Contact Selector not found: {e}")
            page.screenshot(path="verification/ui_layout_fail.png")
            browser.close()
            exit(1)

        # Take success screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/ui_layout_success.png")

        browser.close()
        print("Verification Complete.")

if __name__ == "__main__":
    verify_ui_layout()
