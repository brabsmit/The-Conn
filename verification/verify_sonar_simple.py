
import time
from playwright.sync_api import sync_playwright

def verify_sonar_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        try:
            print("Navigating...")
            page.goto("http://localhost:5173", timeout=60000)

            print("Waiting 10s...")
            time.sleep(10)

            print("Taking screenshot...")
            page.screenshot(path="/home/jules/verification/sonar_verification.png")
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_sonar_display()
