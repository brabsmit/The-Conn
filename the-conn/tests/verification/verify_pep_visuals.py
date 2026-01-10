import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    # Navigate to app
    print("Navigating...")
    page.goto("http://localhost:5173")

    # Wait for app to load (Scenario Select)
    print("Waiting for Scenario Selection...")
    try:
        page.wait_for_selector("text=Safety of Navigation", timeout=60000)
    except Exception as e:
        print("Timeout waiting for Safety of Navigation")
        page.screenshot(path="the-conn/tests/verification/timeout_debug.png")
        raise e

    # Click first scenario to start (Safety of Navigation)
    print("Clicking PLAY (Safety of Navigation)...")
    page.click("text=Safety of Navigation")

    # Wait for Main UI
    print("Waiting for TMA STATION...")
    page.wait_for_selector("text=TMA STATION", timeout=30000)

    # 1. Enable DEV/GOD mode
    print("Enabling DEV mode...")
    page.click("button:has-text('DEV')")
    time.sleep(1)

    # Wait for Scenario Manager
    print("Waiting for SCENARIO MANAGER...")
    page.wait_for_selector("text=SCENARIO MANAGER")

    # 2. Designate a tracker on Sonar using Force click
    # Click on the waterfall to create a tracker
    print("Clicking on Sonar Waterfall...")
    page.mouse.click(640, 400) # Center-ish
    time.sleep(1)

    # Check if a tracker is selected (Header text changes?)
    # We should see "TRACKER S1" somewhere or in ContactManager.

    # 3. Switch to PEP using Force click (something is overlapping)
    print("Switching to PEP (Forced)...")
    page.click("button:has-text('PEP')", force=True)
    time.sleep(5) # Give worker time to calculate

    # Screenshot before drag
    print("Taking Screenshot...")
    page.screenshot(path="the-conn/tests/verification/pep_before_drag.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
