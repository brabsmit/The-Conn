from playwright.sync_api import sync_playwright
import time

def verify_sonar_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173")

            # Wait for Sonar Panel to load
            # The panel title is "Sonar Array"
            page.get_by_text("Sonar Array").wait_for()

            # Wait for some ticks to happen so waterfall generates
            print("Waiting for sonar to populate...")
            time.sleep(5)

            # Take screenshot
            page.screenshot(path="verification/sonar_display.png")
            print("Screenshot taken.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == '__main__':
    verify_sonar_display()
