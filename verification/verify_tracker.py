from playwright.sync_api import sync_playwright
import time

def verify_tracker_management():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for app to load
            page.wait_for_selector("text=Sonar Array", timeout=10000)
            print("App loaded.")

            # 1. Verify Contact List exists
            print("Checking Contact Manager...")
            page.wait_for_selector("text=Contacts")

            # 2. Designate a Tracker
            print("Designating Tracker S1...")
            # Simulate click on Sonar Display to create tracker (assuming center of sonar display)
            # We need to find the canvas or container.
            # The store logic says designateTracker is called.
            # Usually there is an interaction layer.
            # If interaction is not hooked up to UI yet, we might need to manually trigger store via console or assume click works.
            # Memory said: "User interactions to designate new trackers are handled via click events on the SonarDisplay canvas."

            sonar_canvas = page.locator("canvas").first
            box = sonar_canvas.bounding_box()
            if box:
                 # Click in top right quadrant (bearing ~45)
                 x = box['x'] + box['width'] * 0.75
                 y = box['y'] + box['height'] * 0.25
                 page.mouse.click(x, y)
                 print(f"Clicked at {x}, {y}")

            time.sleep(1) # Wait for state update

            # 3. Verify S1 appears in list and is selected
            print("Verifying S1 in list...")
            page.wait_for_selector("text=S1")

            # Take screenshot of selected state
            page.screenshot(path="verification/tracker_selected.png")
            print("Screenshot 1 saved: tracker_selected.png")

            # 4. Verify TMA Display shows dots (Green Circles)
            # It's canvas, so hard to verify DOM, but we can verify NO TRACKER SELECTED is GONE.
            # Wait, S-1 is selected, so "NO TRACKER SELECTED" should NOT be visible.
            if page.is_visible("text=NO TRACKER SELECTED"):
                print("FAIL: 'NO TRACKER SELECTED' is visible when tracker is selected")
            else:
                print("PASS: 'NO TRACKER SELECTED' is hidden")

            # 5. Deselect or Delete
            # Let's delete the tracker.
            print("Deleting Tracker S1...")
            delete_btn = page.locator("button[title='Drop Contact']")
            delete_btn.click()

            time.sleep(1)

            # 6. Verify "NO TRACKER SELECTED" appears
            print("Verifying 'NO TRACKER SELECTED' overlay...")
            if page.is_visible("text=NO TRACKER SELECTED"):
                 print("PASS: 'NO TRACKER SELECTED' is visible after deletion")
            else:
                 print("FAIL: 'NO TRACKER SELECTED' is NOT visible after deletion")

            page.screenshot(path="verification/tracker_deleted.png")
            print("Screenshot 2 saved: tracker_deleted.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_tracker_management()
