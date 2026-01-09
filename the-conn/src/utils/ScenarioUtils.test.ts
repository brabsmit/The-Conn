
import { describe, it, expect } from 'vitest';
import { getPolarPosition, getRandomRange, rotatePoint } from './ScenarioUtils';

describe('ScenarioUtils', () => {
    describe('getPolarPosition', () => {
        it('should return correct position for North (0 degrees)', () => {
            const origin = { x: 0, y: 0 };
            const pos = getPolarPosition(origin, 100, 0);
            expect(pos.x).toBeCloseTo(0);
            expect(pos.y).toBeCloseTo(100);
        });

        it('should return correct position for East (90 degrees)', () => {
            const origin = { x: 0, y: 0 };
            const pos = getPolarPosition(origin, 100, 90);
            expect(pos.x).toBeCloseTo(100);
            expect(pos.y).toBeCloseTo(0);
        });

        it('should handle non-zero origin', () => {
            const origin = { x: 10, y: 20 };
            const pos = getPolarPosition(origin, 100, 0);
            expect(pos.x).toBeCloseTo(10);
            expect(pos.y).toBeCloseTo(120);
        });
    });

    describe('getRandomRange', () => {
        it('should return value within range', () => {
            const min = 10;
            const max = 20;
            for (let i = 0; i < 100; i++) {
                const val = getRandomRange(min, max);
                expect(val).toBeGreaterThanOrEqual(min);
                expect(val).toBeLessThan(max);
            }
        });
    });

    describe('rotatePoint', () => {
        // x = Cross/Right, y = Along/Forward
        // Angle = Clockwise Rotation of the Coordinate System (Heading)

        it('should return identity for 0 degrees', () => {
            // Heading 0 (North): Cross is East(+X), Along is North(+Y)
            // Point (10, 20) -> (10, 20)
            const res = rotatePoint(10, 20, 0);
            expect(res.x).toBeCloseTo(10);
            expect(res.y).toBeCloseTo(20);
        });

        it('should rotate correctly for 90 degrees (East)', () => {
            // Heading 90 (East):
            // Along (Forward) -> East (+X)
            // Cross (Right) -> South (-Y)

            // Case 1: Pure Along (0, 10) -> Should be (10, 0)
            const p1 = rotatePoint(0, 10, 90);
            expect(p1.x).toBeCloseTo(10);
            expect(p1.y).toBeCloseTo(0);

            // Case 2: Pure Cross (10, 0) -> Should be (0, -10)
            const p2 = rotatePoint(10, 0, 90);
            expect(p2.x).toBeCloseTo(0);
            expect(p2.y).toBeCloseTo(-10);
        });

        it('should rotate correctly for 180 degrees (South)', () => {
            // Heading 180:
            // Along -> South (-Y)
            // Cross -> West (-X)

            const p = rotatePoint(10, 20, 180);
            expect(p.x).toBeCloseTo(-10);
            expect(p.y).toBeCloseTo(-20);
        });
    });
});
