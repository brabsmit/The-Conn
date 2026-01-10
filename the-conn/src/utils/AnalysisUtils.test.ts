import { describe, it, expect } from 'vitest';
import { generateSafetyHeatmap } from './AnalysisUtils';
import type { Tracker } from '../store/types';

describe('AnalysisUtils - generateSafetyHeatmap', () => {
    // Mock basic ownship
    const ownship = { x: 0, y: 0 };

    // Helper to create a tracker with a specific solution
    const createTracker = (id: string, range: number, bearing: number, course: number, speed: number): Tracker => ({
        id,
        currentBearing: bearing,
        displayBearing: bearing,
        bearingHistory: [],
        classificationStatus: 'CLASSIFIED',
        timeToClassify: 0,
        solution: {
            legs: [],
            range,
            bearing, // True Bearing
            course,
            speed,
            anchorTime: 0,
            anchorOwnShip: { x: 0, y: 0, heading: 0 },
            computedWorldX: 0,
            computedWorldY: 0
        }
    });

    it('identifies SAFE zones when no trackers present', () => {
        const heatmap = generateSafetyHeatmap(ownship, []);
        // Check a few points
        expect(heatmap[0][5]).toBe('SAFE');
        expect(heatmap[180][20]).toBe('SAFE');
    });

    it('identifies DANGER zone for head-on collision course', () => {
        // Target 5000yds North (0 deg), Heading South (180 deg) at 10kts
        // If we go North (0 deg) at 10kts, we close rapidly.
        // Rel Speed = 20kts. Range 5000. Time = 5000 / (20 * 33) approx 7.5 mins.
        // CPA should be 0.
        const tracker = createTracker('T1', 5000, 0, 180, 10);

        const heatmap = generateSafetyHeatmap(ownship, [tracker]);

        // Course 0 (North), Speed 10 -> Collision
        expect(heatmap[0][10]).toBe('DANGER');
    });

    it('identifies WARNING zone for near miss', () => {
        // Target 5000yds North, Stationary.
        // We go North. CPA 0.
        // Range 5000 > 2000 (Danger) but maybe Warning?
        // Wait, "CPA < 2000 AND Time < 15".
        // If we go 10kts towards it:
        // Speed 10kts ~ 337 yds/min.
        // Time to impact = 5000 / 337 = 14.8 mins.
        // CPA = 0.
        // Should be DANGER (since CPA < 2000 and Time < 15).

        const tracker = createTracker('T2', 5000, 0, 0, 0); // Stationary
        const heatmap = generateSafetyHeatmap(ownship, [tracker]);

        expect(heatmap[0][10]).toBe('DANGER'); // Just under 15 mins
    });

    it('identifies SAFE when diverging', () => {
        // Target 2000yds North, going North at 20kts.
        // We go South at 5kts. Diverging.
        const tracker = createTracker('T3', 2000, 0, 0, 20);
        const heatmap = generateSafetyHeatmap(ownship, [tracker]);

        expect(heatmap[180][5]).toBe('SAFE');
    });
});
