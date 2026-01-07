
from playwright.sync_api import sync_playwright
import time

def verify_sonar_viewport():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1024, 'height': 768})
        page = context.new_page()

        # Start dev server if not running (assumed running or we start it)
        # Assuming Vite on 5173
        try:
            page.goto('http://localhost:5173', timeout=10000)
        except Exception:
            print('Could not connect to localhost:5173')
            browser.close()
            return

        # Wait for app load
        page.wait_for_selector('canvas', timeout=10000)

        # Wait a bit for simulation to run
        time.sleep(2)

        # Take screenshot of Sonar Display (the main canvas)
        page.screenshot(path='verification/sonar_baffle.png')
        print('Screenshot saved to verification/sonar_baffle.png')

        browser.close()

if __name__ == '__main__':
    verify_sonar_viewport()
