from playwright.sync_api import sync_playwright
import time

def verify_dot_stack_residuals():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to app
        page.goto("http://localhost:5173")
        time.sleep(2) # Wait for load

        # Verify "TARGET MOTION ANALYSIS" exists (Assuming it's the title of the panel)
        # Actually, let's look for the canvas
        canvas = page.locator("canvas")
        if canvas.count() > 0:
            print("Canvas found.")

        # Locate the toggle button [GEO]
        toggle_btn = page.locator("button", has_text="[GEO]")
        if toggle_btn.is_visible():
            print("Toggle button [GEO] found.")

            # Click to switch to DOTS
            toggle_btn.click()
            time.sleep(1)

            # Verify button text changes to [DOTS]
            toggle_btn_dots = page.locator("button", has_text="[DOTS]")
            if toggle_btn_dots.is_visible():
                print("Switched to [DOTS] mode successfully.")
            else:
                print("Failed to switch to DOTS mode.")

            # Verify Scale Label
            scale_label = page.get_by_text("SCALE: +/- 10°")
            if scale_label.is_visible():
                print("Scale label found.")
            else:
                print("Scale label NOT found.")

            # Take screenshot of DOTS mode
            page.screenshot(path="verification/dots_mode.png")
            print("Screenshot saved to verification/dots_mode.png")

            # Switch back to GEO
            toggle_btn.click()
            time.sleep(1)
            page.screenshot(path="verification/geo_mode.png")
            print("Screenshot saved to verification/geo_mode.png")

        else:
            print("Toggle button not found!")
            # Take a screenshot to debug
            page.screenshot(path="verification/debug_not_found.png")

        browser.close()

if __name__ == "__main__":
    verify_dot_stack_residuals()
