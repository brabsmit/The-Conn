
import time
from playwright.sync_api import sync_playwright

def verify_geo_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        try:
            print("Navigating to app...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # Click NAV (Using inexact match which worked in debug)
            print("Clicking NAV...")
            page.get_by_text("NAV", exact=False).first.click()

            print("Waiting for GeoDisplay...")
            # Wait for text "MODE: NORTH-UP"
            page.wait_for_selector("text=NORTH-UP", timeout=10000)

            # Setup Scenario
            print("Setting up scenario...")
            page.get_by_text("DEV", exact=False).click()
            page.wait_for_selector("text=Scenario Manager")
            page.get_by_text("Ambush", exact=False).click()
            page.get_by_text("DEV", exact=False).click() # Close

            time.sleep(2)

            # Select Target: The Ambush scenario spawns a target ahead.
            # In North-Up, if we are heading North (0), target is North.
            # Center is screen center. Target is above center.

            cx = 1280 / 2
            cy = 720 / 2
            target_y = cy - 100 # Guessing position

            print(f"Clicking at {cx}, {target_y} to select target...")
            page.mouse.click(cx, target_y)
            time.sleep(1)

            # Capture screenshot
            print("Capturing screenshot...")
            page.screenshot(path="verification_geo_zones.png")

            # Check for SOLUTION IDEAL text
            if page.get_by_text("SOLUTION IDEAL").count() > 0:
                print("SUCCESS: Found 'SOLUTION IDEAL' text!")
            else:
                print("Info: 'SOLUTION IDEAL' text not found (Target might not be in Green Zone or not selected).")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_geo_display()
