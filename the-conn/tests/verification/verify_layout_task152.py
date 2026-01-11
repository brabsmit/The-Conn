import time
from playwright.sync_api import sync_playwright, expect

def verify_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Increase viewport width to ensure layout stabilizes
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173", timeout=30000)

            # Select scenario to enter main app
            print("Selecting Scenario...")
            page.get_by_text("Safety of Navigation").click()

            # Wait for main layout to appear (the grid container)
            # We can look for the main Sonar Array panel title
            print("Waiting for 'Sonar Array' panel...")
            sonar_header = page.get_by_text("Sonar Array").first
            expect(sonar_header).to_be_visible(timeout=10000)

            # Wait a bit for layout to settle
            time.sleep(2)

            # Identify the three main columns
            # The grid items are the direct children of the grid container.
            # We can find them by the text inside their headers or just structure.
            # Grid item 1: Sonar Panel
            # Grid item 2: Main Scope (Tactical Plot / Center)
            # Grid item 3: TMA Controls

            # Get the grid container
            # It's the div with grid-cols-[...]
            # We can identify it by being the parent of the Sonar Array panel's container
            # Or by class check if we could, but classes are compiled/tailwind.

            # Let's select by text containment
            col1 = page.locator("div:has-text('Sonar Array')").first
            # Wait, Sonar Array is inside a Panel inside a div.
            # We need the direct child of the grid.
            # Let's assume the grid container is the one with display: grid.

            # Strategy: Get the element containing "Sonar Array", then traverse up to find the grid item.
            # However, simpler: The layout code shows 3 top-level divs in the grid.
            # Let's inspect the bounding boxes of elements containing specific unique text.

            # Column 1: "Sonar Array"
            el1 = page.get_by_text("Sonar Array").first
            # Column 2: "Tactical Plot" (active by default?) or "TMA STATION" button
            el2 = page.get_by_role("button", name="TMA STATION").first
            # Column 3: "TMA Controls"
            el3 = page.get_by_text("TMA Controls").first

            # Get the grid items (parents of these panels)
            # Actually, let's just get the bounding boxes of the visible panels and infer the grid column widths.
            # The panels fill the grid columns (h-full w-full or flex-grow).

            box1 = el1.locator("xpath=../../..").bounding_box() # Heading -> Header -> Panel -> Wrapper -> GridItem?
            # Adjust locator depth based on DOM structure.
            # Panel structure:
            # <div className="..."><div header><h2>Title</h2>...</div> ... </div>
            # Wrapper: <div className="h-full flex flex-col gap-4 min-w-0"> ... <Panel> ... </div>

            # Let's use specific text locators and look up.
            # Or better, grab the main workspace container.

            # The main workspace has "TMA STATION" button inside it.
            # It has 3 direct children.

            # Let's try to find the grid container directly.
            grid_container = page.locator(".grid").first
            # There might be other grids.
            # This grid has `grid-cols-[33fr_42fr_25fr]`.

            print("Finding grid columns...")
            # Get all direct children of the grid container
            columns = grid_container.locator("> div").all()

            if len(columns) < 3:
                # Maybe we got the wrong grid. Let's try to find the one containing 'Sonar Array'
                print("First grid didn't have 3 columns, searching...")
                grids = page.locator(".grid").all()
                target_grid = None
                for g in grids:
                    if g.locator("text=Sonar Array").count() > 0:
                        target_grid = g
                        break

                if target_grid:
                    columns = target_grid.locator("> div").all()
                else:
                    raise Exception("Could not find main grid container")

            if len(columns) != 3:
                 # It might be that the locator includes other things or I am misinterpreting the DOM.
                 # Let's just measure the panels themselves.
                 # The first column contains "Sonar Array".
                 col1_box = columns[0].bounding_box()
                 col2_box = columns[1].bounding_box()
                 col3_box = columns[2].bounding_box()
            else:
                 col1_box = columns[0].bounding_box()
                 col2_box = columns[1].bounding_box()
                 col3_box = columns[2].bounding_box()

            w1 = col1_box['width']
            w2 = col2_box['width']
            w3 = col3_box['width']
            total = w1 + w2 + w3

            # Calculate ratios
            r1 = w1 / total
            r2 = w2 / total
            r3 = w3 / total

            print(f"Measured Widths: {w1:.1f}, {w2:.1f}, {w3:.1f}")
            print(f"Measured Ratios: {r1:.3f}, {r2:.3f}, {r3:.3f}")
            print(f"Target Ratios:   0.330, 0.420, 0.250")

            # Allow for some tolerance due to gaps and pixel rounding
            tolerance = 0.02

            assert abs(r1 - 0.33) < tolerance, f"Column 1 ratio {r1:.3f} mismatch"
            assert abs(r2 - 0.42) < tolerance, f"Column 2 ratio {r2:.3f} mismatch"
            assert abs(r3 - 0.25) < tolerance, f"Column 3 ratio {r3:.3f} mismatch"

            print("Layout verification passed!")

            # Take screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification_layout.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_layout_error.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    verify_layout()
