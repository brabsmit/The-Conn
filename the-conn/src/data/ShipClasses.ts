export type ShipClassID = 'GUPPY_IIA' | 'STURGEON' | 'SEAWOLF';

export interface ShipClassConfig {
    id: ShipClassID;
    name: String;
    era: 'WWII' | 'COLD_WAR' | 'MODERN';
    
    // 1. Kinematics (How it drives)
    handling: {
        maxSpeedSubmerged: number; // e.g., 12kts vs 35kts
        accelerationRate: number;  // 0.1 (Sluggish) to 0.8 (Sporty)
        turnRate: number;          // Degrees per second
        batteryCapacity: number;   // kWh (Null for Nukes)
    };

    // 2. Acoustics (How it hears)
    sensors: {
        baseSelfNoise: number;     // dB (Diesels are quiet on battery, Nukes hum)
        hullArray: {
            beamWidth: number;     // 20° (Blurry) vs 2° (Sharp)
            gain: number;          // Sensitivity offset
            frequencyMin: number;
            frequencyMax: number;
        };
        hasTowedArray: boolean;    // Diesels don't have this
        hasActiveSonar: boolean;
    };

    // 3. Aesthetics (How it looks)
    uiTheme: {
        primaryColor: string;      // Amber (#FFB000) vs Green (#00FF00) vs Cyan
        fontStyle: string;         // 'Courier New' vs 'Roboto Mono'
        waterfallStyle: 'ANALOG_CRT' | 'DIGITAL_RASTER';
        bezelTexture: 'RUSTY_METAL' | 'MATTE_BLACK';
    };
}