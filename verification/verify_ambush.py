from playwright.sync_api import sync_playwright

def verify_ambush(page):
    # 1. Load app
    page.goto('http://localhost:5173')

    # Wait for the app to load
    page.wait_for_selector('text=SIM TIME')

    # 2. Click SCENARIO
    page.click('text=SCENARIO')

    # 3. Take screenshot of menu
    page.screenshot(path='verification/scenario_menu.png')

    # 4. Click Ambush
    page.click('text=Ambush')

    # 5. Wait a bit for store to update and UI to reflect (though visual changes might be subtle on map without interaction)
    # Check if "SCENARIO" button is still there and maybe dropdown closed
    page.wait_for_timeout(1000)

    # 6. Take screenshot of main screen after loading
    page.screenshot(path='verification/ambush_loaded.png')

    # 7. Open Scenario Manager (DEV) to verify contacts listed
    page.click('text=DEV')
    page.wait_for_selector('text=Scenario Manager')
    page.screenshot(path='verification/scenario_manager.png')

    # Check for text "Sierra-1" and "Sierra-2"
    content = page.content()
    if "Sierra-1" in content and "Sierra-2" in content:
        print("Contacts verified in Scenario Manager")
    else:
        print("Contacts NOT found in Scenario Manager")
        print(content)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_ambush(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
