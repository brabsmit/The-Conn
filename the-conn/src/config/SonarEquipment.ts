/**
 * Sonar Equipment Configuration
 * Defines different sonar array types for player progression system
 */

export interface SonarArrayConfig {
    id: string;
    name: string;
    description: string;

    // Physical Array Properties
    numBeams: number;          // Higher = better resolution
    beamSpacing: number;       // Degrees per bin
    beamWidth: number;         // Physical aperture (degrees)

    // Performance Characteristics
    directivityIndex: number;  // Array gain (dB) - larger arrays = higher DI
    selfNoiseBase: number;     // Base self-noise (dB) - better isolation = lower
    flowNoiseFactor: number;   // Flow noise coefficient - better design = lower

    // Processing Capabilities
    beamformingWindow: 'UNIFORM' | 'HAMMING' | 'BLACKMAN' | 'CHEBYSHEV';
    temporalIntegration: number;  // Integration time (seconds) - longer = better SNR

    // Display Quality
    dynamicRange: number;      // dB - better electronics = wider range
    noiseFloorOffset: number;  // dB - better processing = lower floor
}

/**
 * Sonar Equipment Progression
 * From basic training equipment to cutting-edge systems
 */
export const SONAR_EQUIPMENT: Record<string, SonarArrayConfig> = {
    // Early Cold War - Basic System (1960s)
    BASIC: {
        id: 'BASIC',
        name: 'AN/BQR-2 Passive Array',
        description: 'Early passive sonar with limited resolution and high self-noise',

        numBeams: 360,           // Low resolution
        beamSpacing: 1.0,        // 1 degree bins
        beamWidth: 5.0,          // Wide beam (poor directivity)

        directivityIndex: 12,    // Low array gain
        selfNoiseBase: 60,       // High self-noise (poor isolation)
        flowNoiseFactor: 0.1,    // High flow noise sensitivity

        beamformingWindow: 'UNIFORM',  // No windowing (basic)
        temporalIntegration: 0.1,      // Minimal integration

        dynamicRange: 35,        // Limited electronics
        noiseFloorOffset: 18,    // High noise floor
    },

    // Mid Cold War - Improved System (1970s-1980s)
    STANDARD: {
        id: 'STANDARD',
        name: 'AN/BQQ-5 Sonar Suite',
        description: 'Standard Cold War passive sonar with good performance',

        numBeams: 720,           // Medium resolution
        beamSpacing: 0.5,        // 0.5 degree bins
        beamWidth: 3.0,          // Standard beam

        directivityIndex: 18,    // Good array gain
        selfNoiseBase: 52,       // Moderate self-noise
        flowNoiseFactor: 0.06,   // Moderate flow noise

        beamformingWindow: 'HAMMING',   // Basic windowing
        temporalIntegration: 0.3,       // Standard integration

        dynamicRange: 45,        // Good electronics
        noiseFloorOffset: 12,    // Moderate noise floor
    },

    // Late Cold War - Advanced System (1990s)
    ADVANCED: {
        id: 'ADVANCED',
        name: 'TB-23 Towed Array + Hull Array',
        description: 'Advanced passive sonar with towed array and superior processing',

        numBeams: 720,           // High resolution
        beamSpacing: 0.5,        // 0.5 degree bins
        beamWidth: 2.5,          // Narrow beam

        directivityIndex: 24,    // Excellent array gain (towed array benefit)
        selfNoiseBase: 45,       // Low self-noise (towed array isolation)
        flowNoiseFactor: 0.03,   // Low flow noise

        beamformingWindow: 'BLACKMAN',  // Advanced windowing
        temporalIntegration: 0.5,       // Long integration

        dynamicRange: 55,        // Excellent electronics
        noiseFloorOffset: 8,     // Low noise floor
    },

    // Modern - Cutting Edge System (2000s+)
    MODERN: {
        id: 'MODERN',
        name: 'AN/BQQ-10 Digital Sonar',
        description: 'State-of-the-art digital beamforming with adaptive processing',

        numBeams: 1440,          // Very high resolution
        beamSpacing: 0.25,       // 0.25 degree bins
        beamWidth: 2.0,          // Very narrow beam

        directivityIndex: 28,    // Outstanding array gain
        selfNoiseBase: 40,       // Very low self-noise
        flowNoiseFactor: 0.02,   // Minimal flow noise

        beamformingWindow: 'CHEBYSHEV', // Optimized windowing
        temporalIntegration: 1.0,       // Adaptive integration

        dynamicRange: 65,        // Digital processing
        noiseFloorOffset: 5,     // Very low noise floor
    },
};

/**
 * Default equipment for new games
 */
export const DEFAULT_SONAR_EQUIPMENT = SONAR_EQUIPMENT.STANDARD;
