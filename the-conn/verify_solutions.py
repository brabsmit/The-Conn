from playwright.sync_api import sync_playwright, expect
import time

def verify_solutions():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using a fixed viewport to ensure consistency
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        try:
            # Navigate to the app (assuming Vite default port 5173)
            page.goto("http://localhost:5173")

            # Wait for app to load (checking for SOL button which is in SonarDisplay)
            # This confirms the React app has mounted and rendered the SonarDisplay
            page.wait_for_selector("text=SOL")
            print("App loaded, SOL button found.")

            # Wait for some simulation time to pass so trackers appear
            time.sleep(5)

            # Take a screenshot of the whole UI
            page.screenshot(path="verification_initial.png")
            print("Initial screenshot taken.")

            # Check for TMA Display toggle
            # Note: The button text is [GEO] or [DOTS]
            # We can use a looser selector or try to find it.
            # In TMADisplay.tsx: <button ...>[{viewMode}]</button>
            # So it should be [GEO] initially.

            geo_btn = page.get_by_text("[GEO]")
            if geo_btn.is_visible():
                print("GEO button found, clicking...")
                geo_btn.click()
                time.sleep(1)
                page.screenshot(path="verification_dots.png")
                print("DOTS mode screenshot taken.")
            else:
                print("GEO button not found.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_solutions()
