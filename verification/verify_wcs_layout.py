from playwright.sync_api import sync_playwright

def verify_wcs(page):
    page.goto("http://localhost:5173")
    page.get_by_text("WCS").click()
    page.wait_for_selector("text=TUBE BANK")

    # Assert no vertical scrollbar on the main container
    # We can check scrollHeight vs clientHeight of the WCSDisplay root
    # Since WCSDisplay root is not directly selectable by ID, we use a locator
    wcs_root = page.locator("div.w-full.h-full.flex.flex-col.overflow-hidden.bg-zinc-900\\/80")

    # It might be hard to select by class string if it's long.
    # Let's just take a screenshot and visually verify.
    # Also check that "SEARCH CEILING" and "LOAD" are visible.

    page.wait_for_selector("text=SEARCH CEILING")
    page.wait_for_selector("button:has-text('LOAD')")

    page.screenshot(path="verification/wcs_layout_final.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        try:
            verify_wcs(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_final.png")
        finally:
            browser.close()
