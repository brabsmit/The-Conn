import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from '../../store/useSubmarineStore';

describe('Sector 3: The Teeth (Combat & Weapons)', () => {
  beforeEach(() => {
    useSubmarineStore.getState().resetSimulation();
    useSubmarineStore.setState({
      heading: 0,
      x: 0,
      y: 0,
      contacts: [],
      torpedoes: [],
      gameState: 'RUNNING'
    });
  });

  it('Launch: Call fireTube(), assert weapons count +1 and tube empties', () => {
    const { fireTube, tick } = useSubmarineStore.getState();

    // Setup tube 1 as OPEN with weapon
    useSubmarineStore.setState({
      tubes: [
        { id: 1, status: 'OPEN', progress: 0, weaponData: { runDepth: 50, floor: 100, ceiling: 0, searchMode: 'PASSIVE' } },
        { id: 2, status: 'EMPTY', progress: 0, weaponData: null },
        { id: 3, status: 'EMPTY', progress: 0, weaponData: null },
        { id: 4, status: 'EMPTY', progress: 0, weaponData: null },
      ]
    });

    fireTube(1);

    const s1 = useSubmarineStore.getState();
    expect(s1.torpedoes.length).toBe(1);
    expect(s1.tubes[0].status).toBe('FIRING');

    // Tick to clear FIRING status
    // Must add enemy to prevent Victory
    useSubmarineStore.setState({ contacts: [{ id: 'E1', x: 20000, y: 20000, type: 'ENEMY', status: 'ACTIVE' }] });

    tick(); // FIRING -> EMPTY (progress is instant for FIRING in code? "progress += 1... if >= 100... FIRING->EMPTY")
    // Wait, let's check store logic.
    // "FIRING" is in the list of updatedTube.status logic?
    // "if (['LOADING', ..., 'FIRING'].includes(status)) { progress += 1; ... }"
    // So it takes 100 ticks.

    // I don't want to wait 100 ticks. I'll mock the progress or tick 100 times.
    // I'll set progress to 99 before tick.
    useSubmarineStore.setState((state) => ({
      tubes: state.tubes.map(t => t.id === 1 ? { ...t, progress: 99 } : t)
    }));

    tick();

    const s2 = useSubmarineStore.getState();
    expect(s2.tubes[0].status).toBe('EMPTY');
  });

  it('Guidance: Assert ACTIVE torpedo performs Snake Search', () => {
    const { tick } = useSubmarineStore.getState();
    useSubmarineStore.setState({ contacts: [{ id: 'E1', x: 20000, y: 20000, type: 'ENEMY', status: 'ACTIVE' }] });

    // Create Torpedo manually
    const torpId = 'T1';
    const initialHeading = 0;
    useSubmarineStore.setState({
      torpedoes: [{
        id: torpId,
        position: { x: 0, y: 0 },
        heading: initialHeading,
        targetHeading: initialHeading,
        speed: 40,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'ACTIVE',
        enableRange: 0, // Enabled immediately
        gyroAngle: initialHeading,
        distanceTraveled: 1000, // Past enable range
        history: []
      }]
    });

    // Snake search logic:
    // const phase = ((newTotalDistance - enableRange) % searchPeriod) / searchPeriod;
    // const offset = Math.sin(phase * 2PI) * width;

    tick();

    const t1 = useSubmarineStore.getState().torpedoes[0];
    expect(t1.heading).not.toBe(initialHeading);
    // Should be oscillating.
  });

  it('Guidance: Assert PASSIVE torpedo turns to intercept', () => {
    const { tick } = useSubmarineStore.getState();

    // Target at bearing 90 (East)
    const targetId = 'E1';
    useSubmarineStore.setState({
      contacts: [{ id: targetId, x: 5000, y: 0, type: 'ENEMY', status: 'ACTIVE' }]
    });

    // Torpedo heading 0 (North), designated target E1.
    // Should turn right (towards 90).
    useSubmarineStore.setState({
      torpedoes: [{
        id: 'T2',
        position: { x: 0, y: 0 },
        heading: 0,
        targetHeading: 0,
        speed: 40,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'PASSIVE',
        enableRange: 0,
        gyroAngle: 0,
        distanceTraveled: 1000,
        designatedTargetId: targetId,
        history: []
      }]
    });

    tick();

    const t2 = useSubmarineStore.getState().torpedoes[0];
    // It should have acquired the target if within range.
    // "Acquisition Logic... if (!finalActiveTargetId) ... Prioritize designatedTargetId ... dist < 2000 ... relBearing < 45"
    // Dist is 5000 / 3 = 1666 yards. < 2000.
    // Bearing 90. Heading 0. Rel Bearing 90.
    // RelBearing 90 > 45!
    // It will NOT acquire if relative bearing is > 45 degrees.
    // "Snake Search Pattern" will run instead? Or "newHeading = gyroAngle" if not enabled?
    // It is enabled.

    // Let's set heading to 80 (close to 90).
    useSubmarineStore.setState((state) => ({
      torpedoes: [{ ...state.torpedoes[0], heading: 80, gyroAngle: 80 }]
    }));

    tick();
    const t3 = useSubmarineStore.getState().torpedoes[0];

    // Now it should acquire E1.
    expect(t3.activeTargetId).toBe(targetId);

    // And turn towards it (90).
    // "newHeading = bearingToContact;" (Pure Pursuit, instant turn?)
    // Code: "newHeading = bearingToContact;"
    // Yes, instant turn for homing.
    expect(t3.heading).toBeCloseTo(90, 0);
  });

  it('Collision: Assert target destroyed when weapon < 40yds', () => {
    const { tick } = useSubmarineStore.getState();
    const targetId = 'Target1';

    useSubmarineStore.setState({
      contacts: [{ id: targetId, x: 5000, y: 5000, type: 'ENEMY', status: 'ACTIVE' }],
      torpedoes: [{
        id: 'T_Kill',
        position: { x: 5000, y: 4950 }, // 50 units away. 50 / 3 = 16 yards.
        heading: 0,
        targetHeading: 0,
        speed: 40,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'ACTIVE',
        activeTargetId: targetId, // Locked on
        enableRange: 0,
        gyroAngle: 0,
        distanceTraveled: 5000,
        history: []
      }]
    });

    tick();

    const s = useSubmarineStore.getState();
    const target = s.contacts.find(c => c.id === targetId);
    expect(target!.status).toBe('DESTROYED');
    expect(s.torpedoes[0].status).toBe('EXPLODED');
  });

  it('Game Over: Assert DEFEAT when weapon < 40yds from Ownship', () => {
    const { tick } = useSubmarineStore.getState();

    useSubmarineStore.setState({
      x: 0, y: 0,
      // Need enemy to stay RUNNING initially?
      // Tick logic: "if (activeEnemies.length === 0 ...) VICTORY".
      // But we want DEFEAT.
      // If torpedo hits ownship, newGameState = 'DEFEAT'.
      // This happens inside tick.
      // So if I have no enemies, it might toggle VICTORY *unless* DEFEAT overrides it.
      // Victory check is at the END of tick.
      // "if (newGameState === 'RUNNING') { ... check victory ... }"
      // If collision sets DEFEAT, victory check is skipped.

      torpedoes: [{
        id: 'T_Death',
        position: { x: 0, y: 30 }, // 30 units = 10 yards.
        heading: 180,
        targetHeading: 180,
        speed: 40,
        status: 'RUNNING',
        launchTime: 0,
        searchMode: 'ACTIVE',
        activeTargetId: 'OWNSHIP', // Locked on
        enableRange: 0,
        gyroAngle: 180,
        distanceTraveled: 5000,
        history: []
      }]
    });

    tick();

    expect(useSubmarineStore.getState().gameState).toBe('DEFEAT');
  });
});
