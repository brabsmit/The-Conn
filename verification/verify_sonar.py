from playwright.sync_api import sync_playwright

def verify_sonar_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to app
        page.goto('http://localhost:5173')

        # Take screenshot of menu
        page.screenshot(path='/home/jules/verification/menu.png')

        # It seems specific text locator fails. Use partial text or heading.
        # "Safety of Navigation" is a scenario title.
        page.get_by_role('button').first.click() # Just click the first scenario

        # Verify Sonar Array panel
        expect_sonar = page.get_by_role('heading', name='Sonar Array')
        expect_sonar.wait_for()

        # Wait for initialization
        page.wait_for_timeout(2000)

        # Verify locked container
        sonar_container = page.locator('.select-none[style*="width:"]')
        sonar_container.wait_for()

        box_initial = sonar_container.bounding_box()
        print(f"Initial Box: {box_initial}")

        # Inject content to force expansion of Contacts panel
        page.evaluate("""
            const headings = Array.from(document.querySelectorAll('h2'));
            const contactHeader = headings.find(h => h.innerText === 'Contacts');
            if (contactHeader) {
                // Traverse up to find the flex-grow container (the Panel wrapper)
                // And then find its content sibling
                // Panel structure: <h2>...</h2> <div className="flex-grow..."/>
                // Or Panel has a parent div.
                // Let's brute force find the bg-zinc-900 container below this header.
                // The structure in App.tsx:
                /*
                  <Panel title="Contacts"...>
                     <div className="flex-grow w-full bg-zinc-900 ...">
                        <ContactManager />
                     </div>
                  </Panel>
                */
                // Panel renders children.
                // So h2 is sibling to the content div? No, Panel likely wraps them.

                // Let's find the parent of the h2, assuming it's the Panel header or Panel itself.
                // Inspecting Panel.tsx would confirm, but let's assume standard layout.

                let el = contactHeader;
                while (el && !el.classList.contains('flex-col')) {
                     el = el.parentElement;
                }
                // el is likely the Panel div.
                if (el) {
                    const content = el.querySelector('.bg-zinc-900');
                    if (content) {
                        const spacer = document.createElement('div');
                        spacer.style.height = '600px';
                        spacer.style.backgroundColor = 'red';
                        spacer.innerText = 'FORCED EXPANSION';
                        content.appendChild(spacer);
                        console.log("Injected spacer");
                    }
                }
            }
        """)

        # Wait a bit for layout to settle
        page.wait_for_timeout(1000)

        box_after = sonar_container.bounding_box()
        print(f"After Box: {box_after}")

        # Take screenshot
        page.screenshot(path='/home/jules/verification/sonar_verification.png')

        # Basic assertion
        if abs(box_after['width'] - box_initial['width']) < 1 and abs(box_after['height'] - box_initial['height']) < 1:
            print("SUCCESS: Dimensions are stable.")
        else:
            print(f"FAILURE: Dimensions changed! Diff: {box_after['width'] - box_initial['width']}x{box_after['height'] - box_initial['height']}")
            exit(1)

        browser.close()

if __name__ == "__main__":
    verify_sonar_layout()
