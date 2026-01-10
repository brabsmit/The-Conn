export const ACOUSTICS = {
    // 1. The Targets (Source Levels in dB)
    SOURCE_LEVELS: {
        MERCHANT: 148,  // Standard Transit
        TRAWLER: 142,   // Diesel Chug
        BIOLOGIC: 115,  // Whale Clicks
        ESCORT: 145,    // Warship machinery
        SUB: 130,       // Standard Sub
        TORPEDO: 180    // Screaming
    },

    // 2. The Ocean (Environment)
    ENVIRONMENT: {
        SEA_STATE_NOISE: [55, 60, 65, 68, 73, 80, 85], // dB for States 0-6
        ABSORPTION_COEFF: 0.002, // dB per yard
        CZ_BONUS: 15,            // dB gain in Convergence Zone
        CZ_RANGE_MIN: 28000,
        CZ_RANGE_MAX: 32000
    },

    // 3. The Hardware (Sonar Array)
    ARRAY: {
        NUM_BEAMS: 720,        // High-Density
        BEAM_SPACING: 0.5,     // Degrees per bin
        BEAM_WIDTH: 4.0,       // Degrees (Physical Aperture)
        SENSITIVITY: 1.0,      // Efficiency
        SELF_NOISE_BASE: 50,   // dB (Stationary)
        FLOW_NOISE_FACTOR: 0.05 // Noise += Speed^2 * Factor
    },

    // 4. The Screen (Display Processing)
    DISPLAY: {
        GAMMA: 2.0,            // Contrast crunch
        DYNAMIC_RANGE: 45,     // dB (Min to Max window)
        MIN_SIGNAL_WIDTH: 1,   // Pixels
        MAX_SIGNAL_WIDTH: 4,   // Pixels (Clamp)
        BLOOM_THRESHOLD: 2000  // Yards (Ranges closer than this bloom)
    }
};
