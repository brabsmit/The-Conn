
from playwright.sync_api import sync_playwright

def verify_range_triage():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

        print("Navigating to http://localhost:5173/")
        try:
            page.goto('http://localhost:5173/', timeout=30000)
            print("Navigation complete")
        except Exception as e:
            print(f"Navigation failed: {e}")

        page.wait_for_timeout(2000)

        # Take screenshot of whatever we have
        page.screenshot(path='/home/jules/verification/debug_console.png')

        # Check title
        print(f"Page Title: {page.title()}")

        browser.close()

if __name__ == "__main__":
    verify_range_triage()
