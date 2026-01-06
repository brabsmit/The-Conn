from playwright.sync_api import sync_playwright

def verify_wcs(page):
    # Go to app
    page.goto("http://localhost:5173")

    # Wait for loading if any (assuming not)
    # Click WCS button to switch to WCS Display
    # The WCS button might be in the TopBar or somewhere.
    # Looking at memory: "Global time controls (TimeControls) are rendered within the TopBar component."
    # The activeStation switching might be via keys or some UI.
    # Let's check Panel.tsx or TopBar.tsx.
    # But usually there is a way to switch.
    # The prompt says: "Center Console implements a Multi-Function Display... rendering... based on activeStation"
    # I'll look for text "WCS" to click.
    page.get_by_text("WCS").click()

    # Wait for WCS Display
    page.wait_for_selector("text=TUBE BANK")

    # Screenshot
    page.screenshot(path="verification/wcs_before.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        try:
            verify_wcs(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
