from playwright.sync_api import sync_playwright, expect
import time

def verify_debrief_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Increase viewport to capture more detail
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173/")

            # Wait for app to load
            print("Waiting for app load...")
            page.wait_for_selector("text=Sonar Array", timeout=10000)

            # Open Scenario Manager (DEV button in TopBar)
            print("Opening Scenario Manager...")
            page.get_by_text("DEV").click()

            # Wait for Scenario Manager modal
            page.wait_for_selector("text=Scenario Manager")

            # Select ownship or add a contact to manipulate
            # We want to force a VICTORY condition.
            # VICTORY: No active enemy contacts AND Alert Level NORMAL.
            # Default state has Sierra-1 (ENEMY, MERCHANT).
            # We need to delete Sierra-1.

            print("Deleting Sierra-1...")
            # Click Sierra-1 on map or find it
            # The SVG elements might be tricky, let's look for the contact ID text in SVG
            page.get_by_text("Sierra-1").first.click(force=True)

            # Click Delete Entity
            page.get_by_text("DELETE ENTITY").click()

            # Close Scenario Manager
            print("Closing Scenario Manager...")
            page.get_by_text("✕").click()

            # Wait for Debrief Modal to appear (VICTORY)
            # It checks on tick, which runs every ~16ms.
            print("Waiting for Debrief Modal (Victory)...")
            try:
                page.wait_for_selector("text=MISSION ACCOMPLISHED", timeout=5000)
                print("Victory modal appeared!")
            except:
                print("Victory modal did not appear. Checking Alert Level or remaining contacts.")
                # Maybe need to wait longer or check if something else is keeping it active?
                # Take debug screenshot
                page.screenshot(path="verification/debug_victory_fail.png")
                raise

            # Take screenshot of Victory Modal
            page.screenshot(path="verification/victory_modal.png")
            print("Screenshot saved: verification/victory_modal.png")

            # Test Replay
            print("Testing Replay Button...")
            page.get_by_text("REPLAY MISSION").click()

            # Modal should disappear
            expect(page.get_by_text("MISSION ACCOMPLISHED")).not_to_be_visible()
            print("Modal closed after replay.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    verify_debrief_modal()
