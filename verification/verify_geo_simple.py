
from playwright.sync_api import sync_playwright
import time

def verify_geo_simple():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use localhost explicitly and larger viewport
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        try:
            print('Navigating...')
            response = page.goto('http://localhost:5173/', timeout=60000)
            print(f'Response: {response.status if response else None}')

            # Screenshot initial state
            page.screenshot(path='verification/debug_initial.png')

            # Wait for content
            # The canvas might take a moment to mount if waiting for assets
            # Let's wait for body first
            page.wait_for_selector('body')
            print('Body loaded')

            # Wait for any text to confirm app running
            # Usually 'Safety of Navigation' is on the menu
            try:
                page.wait_for_selector('text=Safety of Navigation', timeout=10000)
                print('Found menu text')
            except:
                print('Menu text not found, dumping HTML')
                print(page.content()[:500])

            page.screenshot(path='verification/geo_loaded.png')

            # If we are at menu, click start
            if page.get_by_text('Safety of Navigation').is_visible():
                page.get_by_text('Safety of Navigation').click()
                time.sleep(1) # Wait for animation/selection

                # Check if INITIATE is visible
                if page.get_by_text('INITIATE').is_visible():
                     page.get_by_text('INITIATE').click(force=True)
                     print('Started Scenario')
                else:
                     print('INITIATE button not found?')
                     page.screenshot(path='verification/debug_no_initiate.png')

                time.sleep(2)

            # Switch to NAV
            print('Switching to NAV...')
            page.keyboard.press('F3')
            time.sleep(1)

            # Check for canvas
            if page.locator('canvas').count() > 0:
                print('Canvas found!')
            else:
                print('No canvas found')

            # Screenshot NAV
            page.screenshot(path='verification/geo_nav.png')

            # Enable GOD Mode
            print('Enabling GOD Mode')
            # Try clicking the GOD button if visible (might be hidden in Expert mode, but defaults to off)
            # Or use shortcut
            page.keyboard.press('Control+Shift+D')
            time.sleep(0.5)

            # Verify clean chart (no aspect circles) - Visual check via screenshot
            page.screenshot(path='verification/geo_god.png')

            # Test Pan
            print('Panning...')
            # Get canvas center
            box = page.locator('canvas').bounding_box()
            if box:
                cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
                page.mouse.move(cx, cy)
                page.mouse.down(button='right')
                page.mouse.move(cx + 100, cy + 100, steps=10)
                page.mouse.up(button='right')
                time.sleep(0.5)
                page.screenshot(path='verification/geo_panned.png')

                # Center
                page.get_by_text('CENTER').click()
                time.sleep(0.5)
                page.screenshot(path='verification/geo_centered.png')

        except Exception as e:
            print(f'Error: {e}')
            page.screenshot(path='verification/error.png')

        finally:
            browser.close()

if __name__ == '__main__':
    verify_geo_simple()
