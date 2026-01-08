import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from '../../store/useSubmarineStore';

describe('Sector 6: The Torture Test (Edge Cases)', () => {
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

  it('Ghost Target: Delete tracked contact while torpedo homing. Assert no Crash', () => {
    const { tick, addContact, fireTube, deleteTracker, removeContact } = useSubmarineStore.getState();
    const targetId = 'Ghost';

    addContact({ id: targetId, x: 5000, y: 5000, type: 'ENEMY', status: 'ACTIVE' });

    // Fire Torpedo at it
    useSubmarineStore.setState({
      torpedoes: [{
        id: 'T1',
        position: { x: 0, y: 0 },
        heading: 0,
        targetHeading: 0,
        speed: 40,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'ACTIVE',
        activeTargetId: targetId,
        enableRange: 0,
        gyroAngle: 0,
        distanceTraveled: 1000,
        history: []
      }]
    });

    tick();

    // Now delete the contact (Simulation remove)
    removeContact(targetId);

    // Tick should handle the missing contact gracefully
    expect(() => tick()).not.toThrow();

    const t = useSubmarineStore.getState().torpedoes[0];
    // Should lose lock
    expect(t.activeTargetId).toBeUndefined();
  });

  it('Tunneling: Fire a projectile at high speed (via Delta). Assert Collision detected', () => {
    const { tick } = useSubmarineStore.getState();
    const targetId = 'TunnelTarget';

    // Target at 2000 yards (6000 units)
    useSubmarineStore.setState({
      contacts: [{ id: targetId, x: 0, y: 6000, type: 'ENEMY', status: 'ACTIVE' }]
    });

    // Torpedo at 0. Speed 45.
    // 45 kts * 1.68 = 75.6 ft/s.
    // We need to jump 6000 units (2000 yards) in one tick.
    // 6000 / 75.6 = ~80 seconds.
    // Delta = 80 * 60 = 4800.

    useSubmarineStore.setState({
      torpedoes: [{
        id: 'T_Fast',
        position: { x: 0, y: 0 },
        heading: 0, // North, towards target
        targetHeading: 0,
        speed: 45,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'ACTIVE',
        activeTargetId: targetId,
        enableRange: 0,
        gyroAngle: 0,
        distanceTraveled: 1000,
        history: []
      }]
    });

    // Tick with huge delta
    tick(5000);

    // Torpedo should have moved way past 6000.
    // If collision check is point-based (dist < 40), it will miss.
    // If raycast, it will hit.

    const s = useSubmarineStore.getState();
    const target = s.contacts[0];

    // Should be destroyed
    expect(target.status).toBe('DESTROYED');
  });

  it('Baffle Flutter: Assert Logs do not spam Contact Lost/Regained', () => {
    const { tick } = useSubmarineStore.getState();

    // Use Torpedo to trigger "Torpedo Detected" / "Torpedo Lost" logs
    useSubmarineStore.setState({
      torpedoes: [{
        id: 'T_Flutter',
        position: { x: 0, y: 0 }, // Relative position will be set via target or ownship?
        // Wait, baffles depend on Relative Bearing.
        // Let's keep Ownship at 0,0 Heading 0.
        // Baffles: 150-210.
        // We need T_Flutter to jump between 149 and 151.
        // At 1000 yards.
        heading: 0, targetHeading: 0, speed: 0, status: 'RUNNING', isHostile: true,
        searchMode: 'PASSIVE', enableRange: 0, gyroAngle: 0, distanceTraveled: 0, history: []
      }]
    });

    // Tick 1: Bearing 149 (Detected)
    // x = sin(149)*dist, y = cos(149)*dist.
    // Bearing 149 is South-East.
    // 149 deg = 2.6 rad.
    // x = 1000 * sin(149 deg), y = 1000 * cos(149 deg).
    const d2r = Math.PI / 180;
    const dist = 3000;

    useSubmarineStore.setState((s) => ({
      torpedoes: [{ ...s.torpedoes[0], position: {
          x: dist * Math.sin(149 * d2r),
          y: dist * Math.cos(149 * d2r)
      }}]
    }));
    tick(); // Should detect -> Log "DETECTED"

    // Tick 2: Bearing 151 (Lost in Baffles)
    useSubmarineStore.setState((s) => ({
      torpedoes: [{ ...s.torpedoes[0], position: {
          x: dist * Math.sin(151 * d2r),
          y: dist * Math.cos(151 * d2r)
      }}]
    }));
    tick(); // Should lose -> Log "Lost"

    // Tick 3: Bearing 149 (Detected)
    useSubmarineStore.setState((s) => ({
      torpedoes: [{ ...s.torpedoes[0], position: {
          x: dist * Math.sin(149 * d2r),
          y: dist * Math.cos(149 * d2r)
      }}]
    }));
    tick(); // Should detect -> Log "DETECTED" again?

    // If debounced, maybe it shouldn't log again so soon?
    // Requirement: "Logs do not spam... more than once per second".
    // 3 ticks = 0.05 seconds.
    // So it should NOT log the second detection.

    const logs = useSubmarineStore.getState().logs;
    const detectedLogs = logs.filter(l => l.message.includes('TORPEDO DETECTED'));
    const lostLogs = logs.filter(l => l.message.includes('Contact lost'));

    // With spam: Detected (1), Lost (2), Detected (3). Total 2 detected.
    // With debounce: Detected (1), Lost (2), Detected (3 - suppressed?).
    // Actually, "Contact Lost" might also need debounce.

    // If "Debounce" means "don't toggle state rapidly", then incomingTorpedoDetected shouldn't flip?
    // Or just logs?
    // Requirement says "Logs do not spam".

    expect(detectedLogs.length).toBeLessThan(2);
  });

  it('Zombie Alert: Allow tracking torpedo to run out of fuel. Assert Red Alert cancels', () => {
    const { tick } = useSubmarineStore.getState();

    // Hostile Torpedo near ownship (Detected)
    useSubmarineStore.setState({
      torpedoes: [{
        id: 'T_Zombie',
        position: { x: 0, y: 1000 },
        heading: 180, targetHeading: 180, speed: 40, status: 'RUNNING', isHostile: true,
        searchMode: 'PASSIVE', enableRange: 0, gyroAngle: 180, distanceTraveled: 19900, // Near limit 20000
        history: []
      }]
    });

    tick();
    expect(useSubmarineStore.getState().alertLevel).toBe('COMBAT');

    // Move slightly more to cross 20000 limit
    useSubmarineStore.setState((s) => ({
        torpedoes: [{ ...s.torpedoes[0], distanceTraveled: 20001 }]
    }));

    tick();

    const s = useSubmarineStore.getState();
    const t = s.torpedoes[0];
    expect(t.status).toBe('DUD');

    // Alert should cancel (NORMAL) if no other threats
    expect(s.alertLevel).toBe('NORMAL');
  });
});
