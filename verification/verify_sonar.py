from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_sonar_view_scaling(page: Page):
    # 1. Arrange: Go to the app
    # Use localhost as 127.0.0.1 failed
    page.goto("http://localhost:5173")

    # Wait for the app to load - wait for body to be visible? No, body exists.
    # Just wait for a known element.
    try:
        page.wait_for_selector("#root", timeout=30000)
    except:
        print(page.content())
        raise

    # Wait for something that is definitely there
    page.wait_for_selector("text=TIMESCALE", timeout=10000)

    # 2. Verify Time Scale Controls exist
    # Be more flexible with selectors
    fast_btn = page.get_by_role("button", name="FAST")
    med_btn = page.get_by_role("button", name="MED")
    slow_btn = page.get_by_role("button", name="SLOW")

    expect(fast_btn).to_be_visible()
    expect(med_btn).to_be_visible()
    expect(slow_btn).to_be_visible()

    # 4. Act: Switch to MED
    med_btn.click()
    time.sleep(1)

    # 5. Act: Switch to SLOW
    slow_btn.click()
    time.sleep(1)

    # Take screenshot
    page.screenshot(path="/home/jules/verification/sonar_scaling.png")

    print("Verification complete")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_sonar_view_scaling(page)
        except Exception as e:
            try:
                page.screenshot(path="/home/jules/verification/error.png")
            except:
                pass
            print(f"Error: {e}")
        finally:
            browser.close()
