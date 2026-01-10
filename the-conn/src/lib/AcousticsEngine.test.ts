import { describe, it, expect } from 'vitest';
import { AcousticsEngine } from './AcousticsEngine';

describe('AcousticsEngine', () => {
    describe('calculateNoiseLevel', () => {
        it('should calculate base noise level for low speed', () => {
            const nl = AcousticsEngine.calculateNoiseLevel(5, 3);
            // New Config:
            // AN for Sea State 3 (index 3): 68dB
            // SN for 5kts: Base 50 + 5^2*0.05 = 50 + 1.25 = 51.25dB
            // AN Power = 10^(6.8) = 6.3e6
            // SN Power = 10^(5.125) = 1.3e5
            // Total Power = 6.43e6
            // dB = 10*log10(6.43e6) = 68.08
            expect(nl).toBeGreaterThan(67);
            expect(nl).toBeLessThan(69);
        });

        it('should increase noise level significantly with speed', () => {
            const lowSpeed = AcousticsEngine.calculateNoiseLevel(5, 3);
            const highSpeed = AcousticsEngine.calculateNoiseLevel(15, 3);
            expect(highSpeed).toBeGreaterThan(lowSpeed);
        });

        it('should apply cavitation penalty above 18kts', () => {
            const preCavitation = AcousticsEngine.calculateNoiseLevel(18, 3);
            const cavitation = AcousticsEngine.calculateNoiseLevel(18.1, 3);
            // Penalty is +20dB to SN component.
            // At 18kts: SN = 55 + 18^2*0.1 = 55 + 32.4 = 87.4dB. AN = 70dB. Total ~ 87.5dB.
            // At 18.1kts: SN = 55 + 18.1^2*0.1 + 20 = 87.7 + 20 = 107.7dB.
            // Total should be dominated by SN ~ 107.7dB.
            // Difference ~ 20dB.
            expect(cavitation - preCavitation).toBeGreaterThan(15);
        });
    });

    describe('calculateTransmissionLoss', () => {
        it('should include spherical spreading and absorption', () => {
            const range = 1000;
            const tl = AcousticsEngine.calculateTransmissionLoss(range, true);
            // 20*log10(1000) = 60dB
            // Absorption 0.002 * 1000 = 2dB
            // Total 62dB
            expect(tl).toBeCloseTo(62, 0.1);
        });

        it('should apply Convergence Zone boost in deep water', () => {
            const rangeNoCZ = 25000;
            const rangeCZ = 30000;

            const tlNoCZ = AcousticsEngine.calculateTransmissionLoss(rangeNoCZ, true);
            const tlCZ = AcousticsEngine.calculateTransmissionLoss(rangeCZ, true);

            // 25k yards: 20*log(25000) ~ 88dB + 50dB alpha = 138dB
            // 30k yards: 20*log(30000) ~ 89.5dB + 60dB alpha = 149.5dB
            // BUT CZ subtracts 15dB -> 134.5dB
            // So 30k should be LOWER (better signal) than 25k despite being further.
            // Wait, 134.5 vs 138. Yes, lower TL.

            expect(tlCZ).toBeLessThan(tlNoCZ);
        });

        it('should NOT apply CZ boost in shallow water', () => {
            const rangeCZ = 30000;
            const tlDeep = AcousticsEngine.calculateTransmissionLoss(rangeCZ, true);
            const tlShallow = AcousticsEngine.calculateTransmissionLoss(rangeCZ, false);

            // Shallow should be higher TL (no boost)
            expect(tlShallow).toBeGreaterThan(tlDeep);
            expect(tlShallow - tlDeep).toBeCloseTo(15, 0.1);
        });
    });
});
