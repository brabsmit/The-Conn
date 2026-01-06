from playwright.sync_api import sync_playwright, expect
import time

def verify_sonar(page):
    page.goto("http://localhost:5173")

    # Wait for the app to load
    page.wait_for_selector("text=Helm")

    # Check if Sonar Display is visible (it's part of the default layout)
    # The SonarDisplay renders into a canvas.
    canvas = page.locator("canvas").first
    expect(canvas).to_be_visible()

    # We want to see the waterfall scrolling.
    # The noise should be visible.
    # We can take a screenshot now, then wait a few seconds and take another to see movement.

    page.screenshot(path="verification/sonar_initial.png")

    # Wait for simulation ticks (approx 3 seconds)
    # We need to ensure the simulation is running.
    # The default state might be paused or slow?
    # Memory says "Simulation loop is throttled... requires extended wait times".
    # And "Global timeScale state (FAST/MED/SLOW)". Default is MED (1s per row).
    # We should speed it up to see scrolling faster.

    # Click "FAST" time control if available.
    # Time controls are in TopBar.
    try:
        page.get_by_text("FAST").click()
        print("Clicked FAST")
    except:
        print("Could not find FAST button")

    time.sleep(5)

    page.screenshot(path="verification/sonar_later.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_sonar(page)
        finally:
            browser.close()
