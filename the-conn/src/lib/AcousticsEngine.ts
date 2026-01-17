import { ACOUSTICS } from '../config/AcousticConstants';

// The Acoustic Physics Engine
// Implements the Passive Sonar Equation: SE = SL - TL - NL + DI

export class AcousticsEngine {

    /**
     * Calculates Noise Level (NL)
     * Formula: NL = 10 * log10(10^(AN/10) + 10^(SN/10))
     *
     * @param speedKts Ownship speed in knots
     * @param seaState Sea State (0-6)
     * @param selfNoiseBase Base self-noise level in dB (equipment-dependent)
     * @param flowNoiseFactor Flow noise coefficient (equipment-dependent)
     * @returns Noise Level in dB
     */
    static calculateNoiseLevel(
        speedKts: number,
        seaState: number = 3,
        selfNoiseBase: number = ACOUSTICS.ARRAY.SELF_NOISE_BASE,
        flowNoiseFactor: number = ACOUSTICS.ARRAY.FLOW_NOISE_FACTOR
    ): number {
        // Ambient Noise (AN)
        const safeSeaState = Math.min(6, Math.max(0, Math.floor(seaState)));
        const an = ACOUSTICS.ENVIRONMENT.SEA_STATE_NOISE[safeSeaState];

        // Self Noise (SN)
        // Base Quiet + Flow Noise
        let sn = selfNoiseBase + (speedKts * speedKts * flowNoiseFactor);

        // Cavitation Penalty (Gradual onset with quadratic growth)
        // Modern submarine designs cavitate around 18-20 knots depending on depth
        const cavitationSpeed = 18;
        if (speedKts > cavitationSpeed) {
            const excessSpeed = speedKts - cavitationSpeed;
            // Quadratic growth: starts at 0, reaches +40 dB at 30+ knots
            const cavitationNoise = Math.min(40, excessSpeed * excessSpeed * 0.3);
            sn += cavitationNoise;
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
        const alpha = ACOUSTICS.ENVIRONMENT.ABSORPTION_COEFF;
        const absorption = alpha * r;

        let tl = spreading + absorption;

        // Convergence Zones (CZ)
        // Only in deep water
        if (deepWater) {
            if (r >= ACOUSTICS.ENVIRONMENT.CZ_RANGE_MIN && r <= ACOUSTICS.ENVIRONMENT.CZ_RANGE_MAX) {
                tl -= ACOUSTICS.ENVIRONMENT.CZ_BONUS; // Signal Boost
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
     * @param directivityIndex Array Gain (DI) in dB - defaults to standard array DI
     * @param deepWater Environment flag
     * @returns Signal Excess in dB
     */
    static calculateSignalExcess(
        sourceLevel: number,
        rangeYards: number,
        noiseLevel: number,
        directivityIndex: number = ACOUSTICS.ARRAY.DIRECTIVITY_INDEX,
        deepWater: boolean = true
    ): number {
        const tl = this.calculateTransmissionLoss(rangeYards, deepWater);
        const rl = sourceLevel - tl;

        return rl - noiseLevel + directivityIndex;
    }

    /**
     * Task 156.1: Active Intercept Calculation (One-Way)
     * Formula: Intercept = SL - TL
     * We hear the ping directly.
     *
     * @param sourceLevel Active Sonar Source Level (SL) in dB
     * @param rangeYards Range to source in yards
     * @param deepWater Environment flag
     * @returns Received Level (RL) in dB
     */
    static calculateActiveOneWay(
        sourceLevel: number,
        rangeYards: number,
        deepWater: boolean = true
    ): number {
        // Note: We might want a different TL for active freq (3.5kHz),
        // but for now we reuse the existing TL model which assumes absorption 0.002.
        const tl = this.calculateTransmissionLoss(rangeYards, deepWater);
        return sourceLevel - tl;
    }

    /**
     * Task 156.1: Active Return Calculation (Two-Way)
     * Formula: Echo = SL - 2*TL + TS
     * The source hears the echo bouncing off the target.
     *
     * @param sourceLevel Active Sonar Source Level (SL) in dB
     * @param rangeYards Range to target in yards
     * @param targetStrength Target Strength (TS) in dB
     * @param deepWater Environment flag
     * @returns Echo Level (EL) at the source in dB
     */
    static calculateActiveTwoWay(
        sourceLevel: number,
        rangeYards: number,
        targetStrength: number,
        deepWater: boolean = true
    ): number {
        const tl = this.calculateTransmissionLoss(rangeYards, deepWater);
        // Two-way loss
        return sourceLevel - (2 * tl) + targetStrength;
    }
}
