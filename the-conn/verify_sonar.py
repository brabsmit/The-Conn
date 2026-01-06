from playwright.sync_api import sync_playwright
import time

def verify_sonar_waterfall():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Listen for console logs
        page.on("console", lambda msg: print(f"BROWSER LOG: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for app to load
            page.wait_for_selector("text=SOL")
            print("App loaded.")

            # Run for 5 seconds to capture logs
            print("Waiting for simulation...")
            time.sleep(5)

            print("Done.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_sonar_waterfall()
