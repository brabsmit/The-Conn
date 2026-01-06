from playwright.sync_api import sync_playwright

def verify_scenario_manager():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        try:
            # Navigate to the app
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for the app to load
            print("Waiting for SIM TIME...")
            page.wait_for_selector("text=SIM TIME", timeout=10000)

            # Click the DEV button
            print("Clicking DEV button...")
            page.get_by_role("button", name="DEV").click()

            # Wait for the Scenario Manager modal
            print("Waiting for GOD VIEW...")
            page.wait_for_selector("text=GOD VIEW (TRUE STATE)", timeout=5000)

            # Click on Sierra-1 contact (default contact)
            print("Selecting Sierra-1...")
            # Using force=True just in case it's covered by something or SVG hit testing is weird
            page.get_by_text("Sierra-1").click(force=True)

            # Verify sidebar form populates with correct range (approx 2357 yds for 5000ft,5000ft)
            print("Checking sidebar...")
            page.wait_for_selector("input[value='2357']", timeout=10000)

            # Take a screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification/scenario_manager.png")
            print("Screenshot saved.")
            print("Success!")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            print("Error screenshot saved.")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_scenario_manager()
