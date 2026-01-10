import { expect, test } from 'vitest';
import { calculateProjectedSolution, calculateSolutionCPA, type TMASolution } from './tma';

test('Static Target, Static Ownship', () => {
    const anchorTime = 100;
    const solution: TMASolution = {
        legs: [],
        anchorTime: anchorTime,
        anchorOwnShip: { x: 0, y: 0, heading: 0 },
        bearing: 90, // East
        range: 1000,
        speed: 0,
        course: 0
    };

    // Check at anchor time
    const proj = calculateProjectedSolution(solution, { x: 0, y: 0, heading: 0 }, anchorTime);
    expect(proj.calcRange).toBeCloseTo(1000);
    expect(proj.calcBearing).toBeCloseTo(90);

    // Check later (should be same since speed 0)
    const proj2 = calculateProjectedSolution(solution, { x: 0, y: 0, heading: 0 }, anchorTime + 60);
    expect(proj2.calcRange).toBeCloseTo(1000);
    expect(proj2.calcBearing).toBeCloseTo(90);
});

test('Moving Target (North)', () => {
    const anchorTime = 0;
    const solution: TMASolution = {
        legs: [],
        anchorTime: anchorTime,
        anchorOwnShip: { x: 0, y: 0, heading: 0 },
        bearing: 90, // Starts East 1000y from Ownship(0,0) -> Target at (1000y, 0)
        range: 1000,
        speed: 10,
        course: 0 // Moving North
    };

    // 10 kts = 10 * 1.68 ft/s = 16.8 ft/s.
    // In 60s -> 1008 ft.
    // 1008 ft = 336 yards.

    const time = 60;
    // Initial Target Pos: X=3000ft (1000y), Y=0.
    // New Target Pos: X=3000ft, Y=1008ft.

    const proj = calculateProjectedSolution(solution, { x: 0, y: 0, heading: 0 }, time);

    // Range = sqrt(1000^2 + 336^2)
    const expectedRange = Math.sqrt(1000**2 + 336**2);
    expect(proj.calcRange).toBeCloseTo(expectedRange, 0);

    // Bearing = atan2(3000, 1008) -> slightly less than 90.
    // atan2(3000, 1008) is angle from North.
    // 1000y East, 336y North.
    // Angle from North is atan(3000/1008) -> atan(2.97) -> ~71 deg.
    // Math.atan2(3000, 1008) * 180 / PI = 71.4 deg.
    expect(proj.calcBearing).toBeCloseTo(71.4, 1);
});

test('AOB Calculation', () => {
    const solution: TMASolution = {
        legs: [],
        anchorTime: 0,
        anchorOwnShip: { x: 0, y: -3000, heading: 0 }, // Ownship at -1000y
        bearing: 0, // Target is North of Ownship
        range: 1000,
        speed: 10,
        course: 0
    };
    // Target is at (0, 0) relative to world origin if Ownship is at (0, -3000)?
    // AnchorOwnShip + (Range, Bearing) -> TargetAnchorPos.
    // Bearing 0 -> North (+Y).
    // TargetAnchorPos = (0, -3000) + (0, 3000) = (0, 0).
    // Target Course 0 (North).

    const proj = calculateProjectedSolution(solution, { x: 0, y: -3000, heading: 0 }, 0);
    // True Bearing Own->Tgt = 0.
    // AOB = (0 + 180) - 0 = 180.
    expect(proj.calcAOB).toBeCloseTo(180);

    const sol2: TMASolution = {
        ...solution,
        course: 90, // Target East
        range: 1000,
        bearing: 0 // Target is North of Ownship
    };
    // Target Heading 90.
    // Bearing to Target = 0.
    // AOB = (0 + 180) - 90 = 90.

    const proj2 = calculateProjectedSolution(sol2, { x: 0, y: -3000, heading: 0 }, 0);
    expect(proj2.calcAOB).toBeCloseTo(90);
});

test('calculateSolutionCPA - Head On', () => {
    // Ownship at (0, 0) Heading North (0), Speed 10kts
    const ownShip = { x: 0, y: 0, heading: 0, speed: 10 };

    // Target at (0, 6000) (2000 yds North), Heading South (180), Speed 10kts
    const solution: TMASolution = {
        legs: [],
        anchorTime: 0,
        anchorOwnShip: { x: 0, y: 0, heading: 0 }, // dummy
        bearing: 0,
        range: 2000, // 2000 yds
        speed: 10,
        course: 180
    };

    // Use current time 0. Target is at (0, 6000).
    // Relative Speed = 20 kts (closing). 20 * 1.68 = 33.6 ft/s.
    // Distance = 6000 ft.
    // Time = 6000 / 33.6 = 178.57s.

    const cpa = calculateSolutionCPA(solution, ownShip, 0);

    expect(cpa.range).toBeCloseTo(0, 0);
    expect(cpa.time).toBeCloseTo(178.6, 1);
});

test('calculateSolutionCPA - Parallel', () => {
    // Ownship at (0, 0) Heading North (0), Speed 10kts
    const ownShip = { x: 0, y: 0, heading: 0, speed: 10 };

    // Target at (3000, 0) (1000 yds East), Heading North (0), Speed 10kts
    const solution: TMASolution = {
        legs: [],
        anchorTime: 0,
        anchorOwnShip: { x: 0, y: 0, heading: 0 },
        bearing: 90,
        range: 1000,
        speed: 10,
        course: 0
    };

    // Relative Velocity is 0. CPA is current range.
    const cpa = calculateSolutionCPA(solution, ownShip, 0);

    expect(cpa.range).toBeCloseTo(1000, 0);
    expect(cpa.time).toBe(0); // V_dot_V is 0
});
