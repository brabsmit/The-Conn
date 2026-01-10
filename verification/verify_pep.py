import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 720})

    try:
        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Select Scenario 1
        print("Selecting Scenario...")
        page.click("text=Safety of Navigation")

        # Wait for Main Screen
        print("Waiting for game load...")
        page.wait_for_selector("text=GEO", timeout=10000)

        # Inject Tracker
        print("Injecting tracker S1...")
        page.evaluate("""
            if (window.useSubmarineStore) {
                window.useSubmarineStore.getState().designateTracker(0);
            }
        """)

        # Click PEP Button
        print("Clicking PEP...")
        pep_btn = page.locator("button:has-text('PEP')")
        pep_btn.wait_for(state="visible", timeout=5000)
        pep_btn.click()

        # Wait for Overlay
        print("Waiting for R1-R2 SOLVER overlay...")
        page.wait_for_selector("text=R1-R2 SOLVER", timeout=5000)

        # Check range update
        print("Clicking 20k...")
        page.click("text=20k")
        page.wait_for_selector("text=Start Range (0-20k)", timeout=2000)

        # Take Screenshot
        print("Taking screenshot...")
        time.sleep(1)
        page.screenshot(path="verification/pep_overlay.png")
        print("Success!")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
