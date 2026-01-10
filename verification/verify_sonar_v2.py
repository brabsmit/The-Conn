
import time
from playwright.sync_api import sync_playwright

def verify_sonar_overlays():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions just in case
        context = browser.new_context(viewport={'width': 1280, 'height': 800}, permissions=['clipboard-read', 'clipboard-write'])
        page = context.new_page()

        # Capture logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        # Navigate to app
        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Wait for load - using specific text from ScenarioSelect.tsx
        print("Waiting for Scenario Select...")
        page.wait_for_selector("text=SUB COMMAND", timeout=10000)

        # Select Scenario 2 (Duel) as it likely has contacts
        print("Selecting Scenario 2...")
        # Button text might be inside h3
        page.click("text=Duel")

        # Wait for game to start
        print("Waiting for Helm Control...")
        # Wait for something that appears in game. "Depth" is in HelmScreen.
        page.wait_for_selector("text=Depth", timeout=10000)

        # Force a tracker by clicking on the sonar (assuming center-ish right-ish)
        # Screen is 1280 wide.
        # Sonar Display should be visible.
        # Let's verify we are on TMA station. Default is TMA.

        print("Clicking to create tracker...")
        # Center: 640. Right: 800. Height 800. Middle 400.
        # Click at 800, 400.
        page.mouse.click(800, 400)

        time.sleep(2) # Wait for tracker creation and smoothing

        print("Taking screenshot...")
        page.screenshot(path="verification/sonar_check.png")
        print("Screenshot saved to verification/sonar_check.png")

        browser.close()

if __name__ == "__main__":
    verify_sonar_overlays()
