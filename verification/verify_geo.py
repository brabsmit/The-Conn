
from playwright.sync_api import sync_playwright
import time

def verify_geo_strip_plot():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        print('Navigating to app...')
        page.goto('http://localhost:5173')

        # Wait for app load
        page.wait_for_selector('canvas')
        print('App loaded.')

        # 1. Start Scenario
        print('Selecting scenario...')
        # Click scenario button if present (Menu State)
        try:
            page.get_by_text('Safety of Navigation').click(timeout=2000)
            page.get_by_text('INITIATE').click(timeout=2000)
            print('Scenario initiated.')
        except:
            print('Already running?')

        # 2. Switch to NAV Station
        print('Switching to NAV Station...')
        page.keyboard.press('F3') # F3 is often NAV shortcut
        # Or click button
        try:
            page.get_by_text('NAV', exact=True).click(timeout=1000)
        except:
            pass

        time.sleep(1)

        # 3. Enable GOD Mode to see contacts
        print('Enabling GOD Mode...')
        page.get_by_text('GOD').click()
        time.sleep(0.5)

        # 4. Designate a Contact (to create a tracker)
        # We need to simulate designating.
        # Click on a contact in the list? Or use keyboard.
        # Let's try clicking on a contact in God Mode on the map?
        # That selects the contact, but doesn't create a tracker unless we designate.
        # Shortcut: 'Enter' designates selected contact bearing?
        # Or use the 'Active Contacts' list.

        # Shortcut: Ctrl+Shift+D is God Mode toggle.

        # Let's assume there is at least one contact.
        # We can use the 'Scenario Manager' or just rely on Scenario 1 having contacts.

        # Zoom In (Mouse Wheel)
        print('Zooming in...')
        page.mouse.move(640, 400)
        page.mouse.wheel(0, -500) # Scroll up to zoom in
        time.sleep(1)

        # Pan
        print('Panning...')
        page.mouse.move(640, 400)
        page.mouse.down(button='right')
        page.mouse.move(500, 300, steps=10)
        page.mouse.up(button='right')
        time.sleep(1)

        # Center
        print('Centering...')
        page.get_by_text('CENTER').click()
        time.sleep(1)

        # Take Screenshot 1: Clean Chart
        print('Taking screenshot 1...')
        page.screenshot(path='verification/geo_clean.png')

        # For Strip Plot, we need a Selected Tracker.
        # Scenario 1 starts with no trackers?
        # Let's try to designate something.
        # If we click 'GOD', we see truth contacts.
        # We can't easily click a canvas element blindly.
        # But we can assume there are contacts.

        # Let's use internal store access if possible? No.
        # We can try to use keyboard shortcut '[' or ']' to cycle contacts/trackers?
        # If no trackers, we can't select one.

        # Let's just verify the Pan/Zoom and Cleanup first.

        browser.close()

if __name__ == '__main__':
    verify_geo_strip_plot()
