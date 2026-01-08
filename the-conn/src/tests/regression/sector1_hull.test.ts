import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from '../../store/useSubmarineStore';

describe('Sector 1: The Hull (Physics & Navigation)', () => {
  beforeEach(() => {
    useSubmarineStore.getState().resetSimulation();
    useSubmarineStore.setState({
      heading: 0,
      speed: 0,
      depth: 0,
      orderedHeading: 0,
      orderedSpeed: 0,
      orderedDepth: 0,
      // @ts-ignore - Mocking fuel/battery if they don't exist yet to fail the test initially
      fuel: 100,
      battery: 100
    });
  });

  it('Kinematics: Verify currentSpeed approaches orderedSpeed over time (Inertia)', () => {
    const { setOrderedSpeed, tick } = useSubmarineStore.getState();
    setOrderedSpeed(10);

    // Initial speed 0
    expect(useSubmarineStore.getState().speed).toBe(0);

    // Tick once
    tick();
    const speedAfter1 = useSubmarineStore.getState().speed;
    expect(speedAfter1).toBeGreaterThan(0);
    expect(speedAfter1).toBeLessThan(10); // Should not jump instantly

    // Tick enough times to reach speed
    for (let i = 0; i < 300; i++) tick();

    expect(useSubmarineStore.getState().speed).toBe(10);
  });

  it('Turning: Verify heading updates based on orderedHeading and wraps 359->0', () => {
    const { setOrderedHeading, tick } = useSubmarineStore.getState();

    // 1. Simple Turn
    setOrderedHeading(90);
    tick();
    expect(useSubmarineStore.getState().heading).toBeGreaterThan(0);

    // 2. Wrap Test (350 -> 10)
    useSubmarineStore.setState({ heading: 350, orderedHeading: 10 });
    tick();
    // Should turn right (cross 0/360)
    // 350 + turn -> 350.5 ... eventually wrap
    // Let's tick enough to cross
    for(let i=0; i<50; i++) tick();

    const h = useSubmarineStore.getState().heading;
    // Should be close to 10 or wrapped
    // If it went the long way (left), it would be < 350.
    // Shortest path 350->10 is +20 deg.

    // Ideally we check intermediate steps, but let's check it reaches 10 eventually
    for(let i=0; i<100; i++) tick();
    expect(useSubmarineStore.getState().heading).toBe(10);
  });

  it('Depth: Verify depth changes and clamps', () => {
    const { setOrderedDepth, tick } = useSubmarineStore.getState();

    setOrderedDepth(100);
    tick();
    expect(useSubmarineStore.getState().depth).toBeGreaterThan(0);

    for(let i=0; i<200; i++) tick();
    expect(useSubmarineStore.getState().depth).toBe(100);

    // Clamp Test (Max Depth)
    setOrderedDepth(2000); // 1200 is max in code
    for(let i=0; i<2000; i++) tick();
    expect(useSubmarineStore.getState().depth).toBe(1200);
  });

  it('Resource Consumption: Assert fuel and battery drain when propulsion is active', () => {
    const { setOrderedSpeed, tick } = useSubmarineStore.getState();

    // @ts-ignore
    const initialFuel = useSubmarineStore.getState().fuel;
    // @ts-ignore
    const initialBattery = useSubmarineStore.getState().battery;

    // Expect them to exist (fail if undefined)
    expect(initialFuel).toBeDefined();
    expect(initialBattery).toBeDefined();

    setOrderedSpeed(10);
    // Speed up
    for(let i=0; i<100; i++) tick(); // running at ~5-10 kts

    // @ts-ignore
    const newFuel = useSubmarineStore.getState().fuel;
    // @ts-ignore
    const newBattery = useSubmarineStore.getState().battery;

    expect(newFuel).toBeLessThan(initialFuel);
    expect(newBattery).toBeLessThan(initialBattery);
  });
});
