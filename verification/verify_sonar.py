
import time
from playwright.sync_api import sync_playwright

def verify_sonar_overlays():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Navigate to app
        page.goto("http://localhost:5173")

        # Wait for load
        page.wait_for_selector("text=Scenario Select", timeout=10000)

        # Select Scenario 2 (Duel) as it likely has contacts
        page.click("text=Scenario 2: Duel")

        # Wait for game to start
        page.wait_for_selector("text=Helm Control", timeout=10000)

        # Wait for simulation to run a bit (smoothing needs ticks)
        # Simulation is 1Hz throttled in headless? Memory says so.
        # But we need to see trackers.
        # Designate a tracker manually if needed, or wait for auto detect?
        # Scenario 2 has a sub. We might not see it immediately.
        # Let's verify 'Green Ghost' absence first.
        # And check tracker rendering if we can see one.

        # Let's try to designate a tracker manually.
        # Click on sonar waterfall at bearing 045?
        # Sonar display is usually central.
        # We need to click "Active Station: TMA" or similar if we are not on it.
        # Default active station is TMA.

        # Click on the waterfall to create a tracker.
        # Waterfall is canvas.
        # Just click near center-right (bearing ~45?)
        # width 1280. Center 640.
        # Click at x=800, y=300
        page.mouse.click(800, 300)

        time.sleep(2) # Wait for tracker creation and render cycle

        # Take screenshot of the Sonar Display Header
        # We can clip to the header area.
        # Header is top 40px of the sonar display.
        # Sonar display might be found via class or id.

        # Just take full screenshot first.
        page.screenshot(path="verification/sonar_full.png")
        print("Full screenshot saved.")

        # Try to locate the sonar container for better screenshot
        # There isn't a clear ID in the code I read, but I can guess or just use full screen.

        browser.close()

if __name__ == "__main__":
    verify_sonar_overlays()
