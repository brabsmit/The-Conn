/**
 * Environmental Configuration
 * Defines oceanic and acoustic conditions for different mission scenarios
 */

export interface EnvironmentConfig {
    id: string;
    name: string;
    description: string;

    // Bathymetry
    waterDepth: number;        // Meters (affects propagation modes)
    deepWater: boolean;        // Deep vs shallow water acoustics

    // Surface Conditions
    seaState: number;          // 0-6 (Beaufort scale equivalent)
    surfaceTemperature: number; // Celsius (affects sound velocity)

    // Water Column Properties
    soundVelocityProfile: 'ISOVELOCITY' | 'SURFACE_DUCT' | 'DEEP_CHANNEL' | 'NEGATIVE_GRADIENT';
    thermoclineDepth: number;  // Meters (seasonal thermocline)
    channelAxis: number;       // Meters (SOFAR channel depth)

    // Bottom Properties
    bottomType: 'SOFT_MUD' | 'SAND' | 'ROCK' | 'BASALT';
    bottomLoss: number;        // dB (absorption on bottom bounce)

    // Ambient Noise Sources
    biologicLevel: number;     // dB (whales, shrimp, fish)
    shippingLevel: number;     // dB (distant merchant traffic)
    rainNoise: boolean;        // High-frequency rain noise

    // Propagation Modifiers
    convergenceZones: boolean; // Enable CZ propagation
    surfaceDuct: boolean;      // Trapped shallow propagation
    bottomBounce: boolean;     // Enable bottom bounce paths
}

/**
 * Pre-defined Environmental Scenarios
 */
export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
    // North Atlantic - Classic Cold War Hunting Grounds
    NORTH_ATLANTIC: {
        id: 'NORTH_ATLANTIC',
        name: 'North Atlantic Deep Water',
        description: 'Deep ocean, convergence zones active, moderate sea state',

        waterDepth: 4000,
        deepWater: true,

        seaState: 3,
        surfaceTemperature: 10,

        soundVelocityProfile: 'DEEP_CHANNEL',
        thermoclineDepth: 100,
        channelAxis: 1000,

        bottomType: 'SOFT_MUD',
        bottomLoss: 2,

        biologicLevel: 0,      // Quiet (high latitude)
        shippingLevel: 5,      // Moderate traffic
        rainNoise: false,

        convergenceZones: true,
        surfaceDuct: false,
        bottomBounce: false,
    },

    // Mediterranean - Shallow Complex Acoustics
    MEDITERRANEAN: {
        id: 'MEDITERRANEAN',
        name: 'Mediterranean Sea',
        description: 'Shallow water, complex multi-path, high shipping noise',

        waterDepth: 800,
        deepWater: false,

        seaState: 2,
        surfaceTemperature: 18,

        soundVelocityProfile: 'SURFACE_DUCT',
        thermoclineDepth: 50,
        channelAxis: 0,        // No deep channel

        bottomType: 'SAND',
        bottomLoss: 5,

        biologicLevel: 5,      // Moderate biologics
        shippingLevel: 15,     // Heavy traffic
        rainNoise: false,

        convergenceZones: false,  // Too shallow
        surfaceDuct: true,
        bottomBounce: true,    // Dominant propagation mode
    },

    // Arctic - Ice and Extreme Conditions
    ARCTIC: {
        id: 'ARCTIC',
        name: 'Arctic Ocean (Ice Cover)',
        description: 'Ice noise, negative gradient, excellent long-range propagation',

        waterDepth: 3500,
        deepWater: true,

        seaState: 0,           // Ice-covered
        surfaceTemperature: -1,

        soundVelocityProfile: 'NEGATIVE_GRADIENT',
        thermoclineDepth: 0,   // No thermocline (isothermal)
        channelAxis: 0,        // Surface channel

        bottomType: 'SOFT_MUD',
        bottomLoss: 1,

        biologicLevel: -5,     // Very quiet (polar)
        shippingLevel: -10,    // Minimal traffic
        rainNoise: false,

        convergenceZones: false,
        surfaceDuct: true,     // Upward refracting (surface trapped)
        bottomBounce: false,
    },

    // Tropical Pacific - High Biologics
    TROPICAL_PACIFIC: {
        id: 'TROPICAL_PACIFIC',
        name: 'Western Pacific Tropical Waters',
        description: 'Warm water, snapping shrimp, strong surface duct',

        waterDepth: 5000,
        deepWater: true,

        seaState: 4,
        surfaceTemperature: 28,

        soundVelocityProfile: 'SURFACE_DUCT',
        thermoclineDepth: 150,
        channelAxis: 1200,

        bottomType: 'BASALT',
        bottomLoss: 8,

        biologicLevel: 15,     // Snapping shrimp (very loud)
        shippingLevel: 10,     // Heavy Pacific shipping
        rainNoise: true,       // Tropical squalls

        convergenceZones: true,
        surfaceDuct: true,
        bottomBounce: false,
    },

    // Norwegian Sea - Storm Conditions
    NORWEGIAN_SEA_STORM: {
        id: 'NORWEGIAN_SEA_STORM',
        name: 'Norwegian Sea (Heavy Weather)',
        description: 'Storm conditions, high ambient noise, difficult detection',

        waterDepth: 2000,
        deepWater: true,

        seaState: 6,           // Heavy seas
        surfaceTemperature: 5,

        soundVelocityProfile: 'ISOVELOCITY',
        thermoclineDepth: 0,   // Mixed by storm
        channelAxis: 800,

        bottomType: 'ROCK',
        bottomLoss: 4,

        biologicLevel: 0,
        shippingLevel: 0,      // Ships avoid storm

        rainNoise: true,       // Heavy precipitation

        convergenceZones: false,
        surfaceDuct: false,
        bottomBounce: true,
    },

    // Calm Ideal - Training Scenario
    CALM_IDEAL: {
        id: 'CALM_IDEAL',
        name: 'Calm Deep Water (Ideal)',
        description: 'Perfect conditions for training and testing',

        waterDepth: 4000,
        deepWater: true,

        seaState: 0,           // Dead calm
        surfaceTemperature: 15,

        soundVelocityProfile: 'DEEP_CHANNEL',
        thermoclineDepth: 80,
        channelAxis: 1000,

        bottomType: 'SOFT_MUD',
        bottomLoss: 2,

        biologicLevel: 0,
        shippingLevel: 0,
        rainNoise: false,

        convergenceZones: true,
        surfaceDuct: false,
        bottomBounce: false,
    },
};

/**
 * Default environment
 */
export const DEFAULT_ENVIRONMENT = ENVIRONMENTS.NORTH_ATLANTIC;
