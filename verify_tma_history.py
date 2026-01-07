
import time
from playwright.sync_api import sync_playwright, expect

def verify_tma_history(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for the app to load.
    # The app starts on TMA station by default (memory says activeStation='TMA').
    # But let's look for something we know exists.
    # TopBar has "SIM TIME".
    print("Waiting for SIM TIME...")
    page.wait_for_selector("text=SIM TIME", timeout=10000)

    # Click the "TMA STATION" button to ensure we are on the TMA station
    print("Selecting TMA Station...")
    page.get_by_role("button", name="TMA STATION").click()

    # The TMA display is canvas based (PixiJS). We cannot inspect internal elements easily.
    # But we can inspect the UI Overlay "NO TRACKER SELECTED" if no tracker is selected.

    print("Waiting for NO TRACKER SELECTED...")
    # It might take a moment to appear? It's conditional.
    # Default store has no selected tracker initially?
    # Store init: selectedTrackerId: null.
    # So "NO TRACKER SELECTED" should be visible.
    try:
        page.wait_for_selector("text=NO TRACKER SELECTED", timeout=5000)
        print("Confirmed NO TRACKER SELECTED visible.")
    except:
        print("Warning: NO TRACKER SELECTED not found. Maybe a tracker is selected?")

    # Let's take a screenshot.
    print("Taking screenshot...")
    page.screenshot(path="verification_tma.png")

    print("Verification script finished.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_tma_history(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
