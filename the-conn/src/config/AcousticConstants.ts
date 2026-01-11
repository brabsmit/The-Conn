export const ACOUSTICS = {
    // 1. The Targets (Source Levels in dB)
    SOURCE_LEVELS: {
        MERCHANT: 135,  // Task 151: Loud
        TRAWLER: 125,   // Task 151: Medium
        BIOLOGIC: 115,  // Unchanged
        ESCORT: 120,    // Task 151: Warship
        SUB: 105,       // Task 151: Stealth
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
        BEAM_WIDTH: 3.0,       // Task 134.3: Revert to 3.0
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
        BLOOM_THRESHOLD: 2000, // Yards (Ranges closer than this bloom)
        SPATIAL_KERNEL: [0.2, 0.6, 0.2], // Task 134.2: Tune the Spread
        NOISE_FLOOR_OFFSET: 12 // Task 136.3: Lower floor to visualize noise
    }
};
