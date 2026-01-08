
import { test, expect } from '@playwright/test';

test('verify sonar bearing mapping (Forward is Center)', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(() => (window as any).useSubmarineStore);

  await page.evaluate(() => {
    const store = (window as any).useSubmarineStore;
    store.getState().loadScenario({}, 'test');
    store.setState({
        appState: 'GAME',
        heading: 0,
        x: 0,
        y: 0,
        trackers: [],
        contacts: [],
        activeStation: 'TMA'
    });
  });

  await page.waitForSelector('text=SOL', { timeout: 5000 });

  const addTracker = async (bearing: number, id: string) => {
    await page.evaluate(({bearing, id}) => {
      const store = (window as any).useSubmarineStore;
      const trackers = store.getState().trackers;
      store.setState({
        trackers: [...trackers, {
            id,
            currentBearing: bearing,
            bearingHistory: [],
            solution: { anchorTime: 0, anchorOwnShip: {x:0,y:0,heading:0}, computedWorldX:0, computedWorldY:0 },
            classificationStatus: 'PENDING',
            timeToClassify: 10
        }]
      });
    }, { bearing, id });
  };

  await addTracker(10, 'T6');   // Starboard Bow -> Right of Center
  await addTracker(350, 'T7');  // Port Bow -> Left of Center
  await addTracker(90, 'T5');   // Starboard Beam -> Right
  await addTracker(270, 'T4');  // Port Beam -> Left

  await page.waitForTimeout(1100);

  const checkPosition = async (id: string) => {
      const container = page.getByTestId('sonar-bezel');
      const trackerText = container.locator(`text=${id}`);
      if (await trackerText.count() === 0) return null; // Not visible

      const el = trackerText.locator('..');
      await el.waitFor({ state: 'visible', timeout: 5000 });
      const style = await el.getAttribute('style');

      const width = await container.evaluate((node) => node.clientWidth);
      const match = style?.match(/left:\s*([\d.]+)px/);
      if (match) {
          const left = parseFloat(match[1]);
          return (left / width) * 100;
      }
      return -1;
  };

  const p6 = await checkPosition('T6');
  console.log(`Tracker T6 (10 deg): ${p6?.toFixed(2)}% (Expected > 50%)`);

  const p7 = await checkPosition('T7');
  console.log(`Tracker T7 (350 deg): ${p7?.toFixed(2)}% (Expected < 50%)`);

  const p5 = await checkPosition('T5');
  console.log(`Tracker T5 (90 deg): ${p5?.toFixed(2)}% (Expected > 75%)`);

  const p4 = await checkPosition('T4');
  console.log(`Tracker T4 (270 deg): ${p4?.toFixed(2)}% (Expected < 25%)`);

  expect(p6).toBeGreaterThan(50);
  expect(p7).toBeLessThan(50);
  expect(p5).toBeGreaterThan(75);
  expect(p4).toBeLessThan(25);
});
