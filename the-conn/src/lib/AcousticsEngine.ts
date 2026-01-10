// The Acoustic Physics Engine
// Implements the Passive Sonar Equation: SE = SL - TL - NL + DI

export class AcousticsEngine {

    /**
     * Calculates Noise Level (NL)
     * Formula: NL = 10 * log10(10^(AN/10) + 10^(SN/10))
     *
     * @param speedKts Ownship speed in knots
     * @param seaState Sea State (0-6)
     * @returns Noise Level in dB
     */
    static calculateNoiseLevel(speedKts: number, seaState: number = 3): number {
        // Ambient Noise (AN)
        // Sea State 1: 60dB, Sea State 6: 80dB. Linear interpolation for simplicity
        const an = 60 + (Math.min(6, Math.max(0, seaState)) / 6) * 20;

        // Self Noise (SN)
        // Base Quiet: 55dB
        // Flow Noise: Speed * Speed * FlowFactor (e.g. 0.1)
        const baseSN = 55;
        const flowFactor = 0.1;
        let sn = baseSN + (speedKts * speedKts * flowFactor);

        // Cavitation Penalty
        if (speedKts > 18) {
            sn += 20;
        }

        // Combine AN and SN
        const anPower = Math.pow(10, an / 10);
        const snPower = Math.pow(10, sn / 10);

        return 10 * Math.log10(anPower + snPower);
    }

    /**
     * Calculates Transmission Loss (TL)
     * Formula: TL = 20 * log10(R) + (alpha * R)
     *
     * @param rangeYards Range to target in yards
     * @param deepWater Is the environment deep water?
     * @returns Transmission Loss in dB
     */
    static calculateTransmissionLoss(rangeYards: number, deepWater: boolean = true): number {
        const r = Math.max(1, rangeYards); // Prevent log(0)

        // Spherical Spreading
        const spreading = 20 * Math.log10(r);

        // Absorption (High Frequency approximation)
        const alpha = 0.002;
        const absorption = alpha * r;

        let tl = spreading + absorption;

        // Convergence Zones (CZ)
        // Only in deep water
        // First CZ window: 30,000 +/- 2,000 yards (28k to 32k)
        if (deepWater) {
            if (r >= 28000 && r <= 32000) {
                tl -= 15; // Signal Boost
            }
        }

        return tl;
    }

    /**
     * Calculates Total Signal Excess (SE)
     * Formula: SE = RL - NL + DI (RL = SL - TL)
     *
     * @param sourceLevel Target Source Level (SL) in dB
     * @param rangeYards Range to target in yards
     * @param noiseLevel Ownship Noise Level (NL) in dB
     * @param directivityIndex Array Gain (DI) in dB
     * @param deepWater Environment flag
     * @returns Signal Excess in dB
     */
    static calculateSignalExcess(
        sourceLevel: number,
        rangeYards: number,
        noiseLevel: number,
        directivityIndex: number = 0,
        deepWater: boolean = true
    ): number {
        const tl = this.calculateTransmissionLoss(rangeYards, deepWater);
        const rl = sourceLevel - tl;

        return rl - noiseLevel + directivityIndex;
    }
}
