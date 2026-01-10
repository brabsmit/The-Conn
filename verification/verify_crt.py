from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Connect to local dev server
        try:
            page.goto("http://localhost:5173", timeout=60000)

            # Wait for application to load (select a scenario to enter game)
            # Click "Safety of Navigation" which is usually the default or first button
            page.get_by_role("button", name="Safety of Navigation").click()

            # Wait for game to load
            time.sleep(5)

            # The sonar display should be visible.
            # We want to see the "noise" and "scanlines".
            # We can take a screenshot of the sonar display element.

            # Locate Sonar Display
            sonar_display = page.get_by_test_id("sonar-display")

            if sonar_display.is_visible():
                print("Sonar Display visible, taking screenshot...")
                sonar_display.screenshot(path="verification/sonar_crt_effect.png")
            else:
                print("Sonar Display not found!")
                page.screenshot(path="verification/full_page_error.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
