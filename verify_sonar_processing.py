from playwright.sync_api import sync_playwright
import time

def verify_sonar(page):
    page.goto("http://localhost:3000")

    # Wait for canvas
    page.wait_for_selector("canvas")

    # Wait for simulation to run and waterfall to fill a bit
    # Default time scale is FAST, but let's just wait 5 seconds.
    # We might want to set Time Scale to FAST if it isn't.
    # The store initializes with FAST.
    time.sleep(10)

    # Take screenshot
    page.screenshot(path="verification_sonar.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_sonar(page)
        finally:
            browser.close()
