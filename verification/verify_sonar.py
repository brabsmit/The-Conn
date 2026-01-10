from playwright.sync_api import sync_playwright
import time

def run(page):
    print("Navigating to app...")
    try:
        page.goto("http://localhost:5173", timeout=30000)
    except Exception as e:
        print(f"Navigation failed: {e}")
        return

    print("Waiting for Sonar Array panel...")
    try:
        # Wait for the panel header text
        page.wait_for_selector("text=SONAR ARRAY", timeout=10000)
        print("Sonar Array detected.")
    except:
        print("Sonar Array not found. Saving debug screenshot.")
        page.screenshot(path="verification/failed_load.png")
        return

    # Ensure FAST mode is active for rapid updates
    try:
        page.get_by_role("button", name="FAST").click(force=True)
    except:
        pass # Might be already active

    print("Accumulating sonar history (5s)...")
    time.sleep(5)

    output_path = "verification/sonar_recalibrated.png"
    page.screenshot(path=output_path)
    print(f"Verification screenshot saved to {output_path}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        finally:
            browser.close()
