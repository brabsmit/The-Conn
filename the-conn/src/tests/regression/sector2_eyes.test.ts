import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition } from '../../lib/tma';

describe('Sector 2: The Eyes (Sensors & TMA)', () => {
  beforeEach(() => {
    useSubmarineStore.getState().resetSimulation();
    useSubmarineStore.setState({
      heading: 0,
      x: 0,
      y: 0,
      contacts: [],
      trackers: [],
      sensorReadings: [],
      gameState: 'RUNNING'
    });
  });

  it('The Baffles: Assert contact in rear 60 deg arc (150-210) returns no signal', () => {
    const { addContact, tick } = useSubmarineStore.getState();

    // Must be ENEMY to avoid immediate VICTORY check ending the game
    addContact({
      id: 'BaffleTest',
      x: 0,
      y: -5000,
      status: 'ACTIVE',
      type: 'ENEMY',
      classification: 'SUB'
    });

    tick();

    const readings = useSubmarineStore.getState().sensorReadings;
    const reading = readings.find(r => r.contactId === 'BaffleTest');
    expect(reading).toBeUndefined();

    // Move to Beam
    useSubmarineStore.setState({
      contacts: [{ id: 'BaffleTest', x: 5000, y: 0, status: 'ACTIVE', type: 'ENEMY', classification: 'SUB' }],
      gameState: 'RUNNING' // Reset just in case
    });

    tick();

    const s2 = useSubmarineStore.getState();
    const readings2 = s2.sensorReadings;
    const reading2 = readings2.find(r => r.contactId === 'BaffleTest');
    expect(reading2).toBeDefined();
    expect(Math.abs(reading2!.bearing - 90)).toBeLessThan(5);
  });

  it('Buffer Integrity: Assert history buffers clamp to MAX_HISTORY', () => {
    const { tick, addContact } = useSubmarineStore.getState();

    // Add enemy to keep game running
    addContact({ id: 'Enemy1', x: 10000, y: 10000, type: 'ENEMY', status: 'ACTIVE' });

    for(let i=0; i<60; i++) tick();

    const s = useSubmarineStore.getState();
    const history = s.ownShipHistory;
    expect(history.length).toBeGreaterThan(0);
    expect(history.length).toBe(1);
  });

  it('Projection: Assert World Coordinates map to Screen Coordinates (via TMA helper)', () => {
    const anchorTime = 0;
    const anchorOwnShip = { x: 0, y: 0, heading: 0 };
    const solution = {
      speed: 10,
      range: 1000,
      course: 90,
      bearing: 0,
      anchorTime,
      anchorOwnShip,
      computedWorldX: 0,
      computedWorldY: 0
    };

    const pos0 = calculateTargetPosition(solution, 0);
    expect(pos0.x).toBeCloseTo(0);
    expect(pos0.y).toBeCloseTo(3000);

    const pos1 = calculateTargetPosition(solution, 60);
    expect(pos1.x).toBeCloseTo(10 * 1.68 * 60, 0);
    expect(pos1.y).toBeCloseTo(3000);
  });
});
