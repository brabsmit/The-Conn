
import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    page.goto("http://localhost:5173")
    page.wait_for_timeout(2000)

    try:
        page.get_by_text("Safety of Navigation").click()
    except:
        print("Could not find scenario button, dumping content")
        print(page.content())
        browser.close()
        return

    page.get_by_text("DEV").click()
    page.get_by_role("button", name="+ ADD CONTACT").click()

    ai_button = page.get_by_text("[ AI: ACTIVE ]")
    expect(ai_button).to_be_visible()

    # 7. Toggle AI Off
    ai_button.click()

    resume_button = page.get_by_text("[ RESUME AI ]")
    expect(resume_button).to_be_visible()

    page.screenshot(path="verification/verify_ai_disabled.png")

    # 8. Resume
    resume_button.click()
    expect(page.get_by_text("[ AI: ACTIVE ]")).to_be_visible()

    # 9. Verify Auto-Disable on Manual Update
    # Select the speed input specifically.
    # It is the 4th number input in the sidebar.
    page.locator("input[type='number']").nth(3).fill("15")
    page.get_by_text("UPDATE ENTITY").click()

    expect(page.get_by_text("[ RESUME AI ]")).to_be_visible()
    page.screenshot(path="verification/verify_auto_disable.png")

    # 10. Verify Locking Timer
    page.get_by_text("[ RESUME AI ]").click()

    # Use nth(0) for the sidebar select or check parent
    # The sidebar one is likely the first one or we can scope it
    # <select class="bg-zinc-900 ...">
    page.locator("div.bg-zinc-800 select").select_option("SUB")
    page.get_by_text("UPDATE ENTITY").click()
    page.get_by_text("[ RESUME AI ]").click()

    page.get_by_text("[FORCE DETECT]").click()

    # Wait for locking
    page.wait_for_timeout(5000)
    page.screenshot(path="verification/verify_locking_attempt.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
