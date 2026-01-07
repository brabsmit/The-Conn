import sys
import os
from playwright.sync_api import sync_playwright
import time

def verify_combat_state():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Enable console logging
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

        print("Loading app...")
        page.goto("http://localhost:5173")

        # Wait for app to load - "SIM TIME" is static text in the TopBar
        print("Waiting for app initialization...")
        page.wait_for_selector("text=SIM TIME", timeout=30000)

        # Open Scenario Menu (not DEV)
        print("Opening Scenario Menu...")
        page.click("text=SCENARIO")

        # Click Ambush
        print("Loading Ambush scenario...")
        page.click("text=Ambush")

        print("Waiting for S1 (Merchant) to classify...")
        try:
            # Wait longer for initial classification
            page.wait_for_selector("text=MERCHANT", timeout=20000)
            print("S1 Classified as MERCHANT.")
        except Exception as e:
            print(f"Timed out waiting for MERCHANT: {e}")
            page.screenshot(path="verification/combat_timeout_merchant.png")
            raise e

        print("Waiting for S2 (Sub) to classify...")
        try:
            # S2 takes 5 game seconds.
            page.wait_for_selector("text=SUB", timeout=30000)
            print("S2 Classified as SUB.")
        except Exception as e:
            print(f"Timed out waiting for SUB: {e}")
            page.screenshot(path="verification/combat_timeout_sub.png")
            raise e

        # Wait a moment for the red flash/overlay to appear
        time.sleep(2)

        # Verify the overlay exists in the DOM
        print("Checking for Red Overlay...")
        overlay_exists = page.evaluate("""() => {
            const divs = Array.from(document.querySelectorAll('div'));
            return divs.some(d => {
                const style = getComputedStyle(d);
                return style.background.includes('gradient') && style.mixBlendMode === 'multiply';
            });
        }""")

        if overlay_exists:
            print("Red Vignette Overlay detected.")
        else:
            print("WARNING: Red Vignette Overlay NOT detected via DOM check.")

        # Take screenshot
        print("Taking verification screenshot...")
        page.screenshot(path="verification/combat_state.png")

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_combat_state()
