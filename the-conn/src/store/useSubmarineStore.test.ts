import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from './useSubmarineStore';

describe('useSubmarineStore', () => {
  beforeEach(() => {
    // Reset state completely
    useSubmarineStore.getState().resetSimulation();

    // Set minimal state for testing, ensuring GAME mode so tick runs
    useSubmarineStore.setState({
      appState: 'GAME', // Critical for tick to run
      gameState: 'RUNNING',
      viewScale: 'FAST',
      trackers: [],
      sensorReadings: [],
      contacts: [],
      gameTime: 0
    });
  });

  it('should have default viewScale as FAST', () => {
    const state = useSubmarineStore.getState();
    expect(state.viewScale).toBe('FAST');
  });

  it('should update viewScale correctly', () => {
    const { setViewScale } = useSubmarineStore.getState();

    setViewScale('MED');
    expect(useSubmarineStore.getState().viewScale).toBe('MED');

    setViewScale('SLOW');
    expect(useSubmarineStore.getState().viewScale).toBe('SLOW');

    setViewScale('FAST');
    expect(useSubmarineStore.getState().viewScale).toBe('FAST');
  });

  // Task 115: Automated FTOW Tests
  it('should trigger FTOW after 30 seconds of neglect', () => {
    // 1. Setup Contact and Tracker
    const contact = {
        id: 'C1',
        x: 10000,
        y: 10000,
        heading: 90,
        speed: 10,
        type: 'ENEMY' as const,
        status: 'ACTIVE' as const
    };
    useSubmarineStore.getState().addContact(contact);

    // Fake a sensor reading so designate works with contact ID
    useSubmarineStore.setState({
        sensorReadings: [{ contactId: 'C1', bearing: 45 }] // Simple bearing
    });

    useSubmarineStore.getState().designateTracker(45);

    let tracker = useSubmarineStore.getState().trackers[0];
    expect(tracker).toBeDefined();
    expect(tracker.contactId).toBe('C1');
    expect(tracker.creationTime).toBe(0);
    expect(tracker.lastInteractionTime).toBe(0);
    expect(tracker.isAutoSolution).toBe(false);

    // 2. Advance Time < 30s (e.g. 29s)
    useSubmarineStore.setState({ gameTime: 29 });
    useSubmarineStore.getState().tick(1);

    tracker = useSubmarineStore.getState().trackers[0];
    expect(tracker.isAutoSolution).toBe(false); // Should not have triggered

    // 3. Advance Time > 30s (e.g. 31s)
    useSubmarineStore.setState({ gameTime: 31 });
    useSubmarineStore.getState().tick(1);

    tracker = useSubmarineStore.getState().trackers[0];
    expect(tracker.isAutoSolution).toBe(true); // Should trigger

    // Check Log
    const logs = useSubmarineStore.getState().logs;
    expect(logs.some(l => l.message.includes('FTOW: MLE APPLIED'))).toBe(true);

    // Verify Solution is somewhat valid (noisy) but not undefined
    expect(tracker.solution.speed).toBeGreaterThan(0);
  });

  it('should NOT trigger FTOW if user interacted', () => {
    // 1. Setup
    const contact = { id: 'C2', x: 20000, y: 20000, heading: 180, speed: 15, type: 'ENEMY' as const, status: 'ACTIVE' as const };
    useSubmarineStore.getState().addContact(contact);
    useSubmarineStore.setState({ sensorReadings: [{ contactId: 'C2', bearing: 135 }] });
    useSubmarineStore.getState().designateTracker(135);

    let tracker = useSubmarineStore.getState().trackers[0];

    // 2. User Interacts at T=10
    useSubmarineStore.setState({ gameTime: 10 });
    useSubmarineStore.getState().updateTrackerSolution(tracker.id, { speed: 12 }); // Interaction

    tracker = useSubmarineStore.getState().trackers[0];
    expect(tracker.lastInteractionTime).toBe(10);
    expect(tracker.isAutoSolution).toBe(false);

    // 3. Advance Time to T=35 (Original creation was 0, so >30s from creation, but interaction was recent-ish?)
    // Logic: (Now - Creation > 30) AND (LastInteraction == Creation)
    // Here LastInteraction (10) != Creation (0). So it should NOT trigger.
    useSubmarineStore.setState({ gameTime: 35 });
    useSubmarineStore.getState().tick(1);

    tracker = useSubmarineStore.getState().trackers[0];
    expect(tracker.isAutoSolution).toBe(false);
  });
});
