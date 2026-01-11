
from playwright.sync_api import sync_playwright
import time

def verify_geo_canvas():
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

                # Check for Initiate
                try:
                    page.get_by_text('INITIATE').click(timeout=3000)
                    print('Started Scenario')
                except:
                    print('INITIATE not clickable, maybe already running or loading')

                time.sleep(2)

            # Switch to NAV
            print('Switching to NAV...')
            page.keyboard.press('F3')
            time.sleep(1)

            # Dump page structure to find where the canvas is
            print('Finding Canvas...')
            canvases = page.locator('canvas').all()
            print(f'Found {len(canvases)} canvases')

            # Find the one that is likely GeoDisplay
            # Sonar is usually on the left (first?)
            # GeoDisplay (Center) is second?

            target_canvas = None

            # Heuristic: Find the canvas that is inside a container with 'MODE: NORTH-UP'
            # We can traverse up from the text
            try:
                mode_text = page.locator('text=MODE: NORTH-UP')
                if mode_text.count() > 0:
                    print('Found MODE: NORTH-UP text')
                    # Go up to container
                    container = mode_text.locator('..').locator('..')
                    target_canvas = container.locator('canvas').first
                    print('Resolved canvas via text')
                else:
                    print('MODE: NORTH-UP text not found')
                    # Fallback to 2nd canvas?
                    if len(canvases) >= 2:
                        target_canvas = canvases[1]
                        print('Falling back to 2nd canvas')
            except Exception as ex:
                print(f'Locator error: {ex}')

            if target_canvas:
                print('Testing Interaction on Canvas')
                box = target_canvas.bounding_box()
                if box:
                    cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2

                    # Take screenshot before
                    page.screenshot(path='verification/geo_pre_pan.png')

                    # Pan
                    page.mouse.move(cx, cy)
                    page.mouse.down(button='right')
                    page.mouse.move(cx + 200, cy + 200, steps=10)
                    page.mouse.up(button='right')
                    time.sleep(1)

                    # Screenshot after
                    page.screenshot(path='verification/geo_post_pan.png')

                    # Check for CENTER button
                    center_btn = page.get_by_text('CENTER')
                    if center_btn.count() > 0:
                        center_btn.first.click()
                        time.sleep(1)
                        page.screenshot(path='verification/geo_recentered.png')
                        print('Center button clicked')
                    else:
                        print('Center button not found')
                else:
                    print('Canvas has no bounding box')
            else:
                print('Target Canvas not identified')

        except Exception as e:
            print(f'Error: {e}')
            page.screenshot(path='verification/error.png')

        finally:
            browser.close()

if __name__ == '__main__':
    verify_geo_canvas()
