import { describe, it, expect } from 'vitest';
import { normalizeAngle } from '../../lib/tma';

// Replicating the logic from SonarOverlay for verification
const calculateBearing = (clickX: number, width: number) => {
    const viewAngle = (clickX / width) * 300;
    let relBearing = 0;

    if (viewAngle <= 150) {
        relBearing = viewAngle + 210;
    } else {
        relBearing = viewAngle - 150;
    }

    return normalizeAngle(relBearing);
};

describe('Sonar Overlay Logic', () => {
    it('maps left edge (0px) to 210 degrees', () => {
        const bearing = calculateBearing(0, 1000);
        expect(bearing).toBe(210);
    });

    it('maps center (width/2) to 0/360 degrees', () => {
        const bearing = calculateBearing(500, 1000); // 150 view angle
        // 150 + 210 = 360 -> 0
        expect(bearing).toBe(0);
    });

    it('maps right edge (width) to 150 degrees', () => {
        const bearing = calculateBearing(1000, 1000); // 300 view angle
        // 300 - 150 = 150
        expect(bearing).toBe(150);
    });

    it('maps quarter (width/4) to 285 degrees', () => {
        const bearing = calculateBearing(250, 1000); // 75 view angle
        // 75 + 210 = 285
        expect(bearing).toBe(285);
    });
});
