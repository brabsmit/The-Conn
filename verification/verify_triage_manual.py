
from playwright.sync_api import sync_playwright

def verify_range_triage():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load the application
        page.goto('http://localhost:5173/')

        # 2. Select a scenario (Scenario 1)
        page.wait_for_selector('text=Safety of Navigation')
        page.click('text=Safety of Navigation')

        # 3. Switch to NAV station
        # Based on App.tsx, the button text is "NAV STATION"
        page.click('text=NAV STATION')

        # Short wait
        page.wait_for_timeout(1000)

        # 4. Toggle Triage Display
        toggle_button = page.locator('button:has-text("SHOW TRIAGE")')

        if toggle_button.is_visible():
             toggle_button.click()
             print("Clicked Show Triage")
        else:
             print("Show Triage button not visible")
             # Take a screenshot here
             page.screenshot(path='/home/jules/verification/nav_screen.png')

        # 5. Wait for Display
        try:
             page.wait_for_selector('h3:has-text("VELOCITY TRIAGE")', timeout=5000)
             print("Triage Display Visible")
        except:
             print("Triage Display NOT Visible")

        # 6. Interact to set a trial vector (Drag on canvas)
        canvas = page.locator('.relative.cursor-crosshair canvas')
        box = canvas.bounding_box()
        if box:
            # Drag from center to right
            page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            page.mouse.down()
            page.mouse.move(box['x'] + box['width'] * 0.75, box['y'] + box['height'] / 2)
            page.mouse.up()

            # Wait for text update
            try:
                page.wait_for_selector('text=C-090', timeout=2000)
                print("Text Updated Correctly")
            except:
                print("Text update failed or different value")

        # 7. Take Screenshot
        page.screenshot(path='/home/jules/verification/range_triage_final.png')
        browser.close()

if __name__ == "__main__":
    verify_range_triage()
