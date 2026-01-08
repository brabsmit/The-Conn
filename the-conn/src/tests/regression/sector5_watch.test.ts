import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from '../../store/useSubmarineStore';

describe('Sector 5: The Watch Team (Crew Automation)', () => {
  beforeEach(() => {
    useSubmarineStore.getState().resetSimulation();
    useSubmarineStore.setState({
      heading: 0,
      x: 0,
      y: 0,
      gameState: 'RUNNING',
      contacts: [],
      torpedoes: [],
      trackers: [],
      logs: []
    });
  });

  it('Auto-Detect & Red Alert: Spawn hostile weapon within detection range. Assert new Tracker and Alert Level', () => {
    const { tick } = useSubmarineStore.getState();

    // Add hostile torpedo within passive range (3000)
    // 2000 yards = 6000 units.
    useSubmarineStore.setState({
      torpedoes: [{
        id: 'T_Threat',
        position: { x: 0, y: 6000 }, // 2000 yds North
        heading: 180,
        targetHeading: 180,
        speed: 40,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'PASSIVE',
        enableRange: 0,
        gyroAngle: 180,
        distanceTraveled: 1000,
        isHostile: true,
        history: []
      }]
    });

    tick();

    const s = useSubmarineStore.getState();

    // Check Tracker
    const weaponTracker = s.trackers.find(t => t.kind === 'WEAPON');
    expect(weaponTracker).toBeDefined();
    expect(weaponTracker!.id).toContain('T_Threat');

    // Check Alert Level
    expect(s.alertLevel).toBe('COMBAT');

    // Check Evasion Prompt Flag
    expect(s.incomingTorpedoDetected).toBe(true);
  });
});
