
from playwright.sync_api import sync_playwright
import time

def verify_geo_final():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use localhost explicitly and larger viewport
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        try:
            print('Navigating...')
            response = page.goto('http://localhost:5173/', timeout=60000)
            print(f'Response: {response.status if response else None}')

            # Wait for any text to confirm app running
            page.wait_for_selector('text=Safety of Navigation', timeout=10000)

            # If we are at menu, click start
            if page.get_by_text('Safety of Navigation').is_visible():
                page.get_by_text('Safety of Navigation').click()
                time.sleep(1)

                if page.get_by_text('INITIATE').is_visible():
                     page.get_by_text('INITIATE').click(force=True)
                     print('Started Scenario')
                else:
                     print('INITIATE button not found? Checking if already running.')

                time.sleep(2)

            # Switch to NAV
            print('Switching to NAV...')
            page.keyboard.press('F3')
            time.sleep(1)

            # Identify the correct canvas.
            # The error says there are 3.
            # GeoDisplay is usually the one with the GOD button inside its container or nearby?
            # Or we can target by size or location.
            # The NAV canvas is likely the one in the 25fr column? No, NAV station is usually full screen or MFD.
            # In MFD layout, there is Sonar (Waterfall + Overlay) and Center.
            # When F3 is pressed, Center becomes GeoDisplay.

            # Let's try to find the container with 'MODE: NORTH-UP'.
            print('Looking for GeoDisplay...')
            geo_container = page.locator('div', has_text='MODE: NORTH-UP').last

            # Screenshot NAV
            page.screenshot(path='verification/geo_nav.png')

            # Enable GOD Mode
            print('Enabling GOD Mode')
            page.keyboard.press('Control+Shift+D')
            time.sleep(0.5)

            # Verify clean chart (no aspect circles) - Visual check via screenshot
            page.screenshot(path='verification/geo_god.png')

            # Test Pan
            print('Panning...')
            # Get canvas inside Geo container
            canvas = geo_container.locator('canvas').first

            box = canvas.bounding_box()
            if box:
                cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
                page.mouse.move(cx, cy)
                page.mouse.down(button='right')
                page.mouse.move(cx + 100, cy + 100, steps=10)
                page.mouse.up(button='right')
                time.sleep(0.5)
                page.screenshot(path='verification/geo_panned.png')

                # Center
                # Click the CENTER button inside the geo container
                geo_container.get_by_text('CENTER').click()
                time.sleep(0.5)
                page.screenshot(path='verification/geo_centered.png')
            else:
                print('Geo Canvas not found')

        except Exception as e:
            print(f'Error: {e}')
            page.screenshot(path='verification/error.png')

        finally:
            browser.close()

if __name__ == '__main__':
    verify_geo_final()
