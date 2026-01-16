# Acoustic Configuration System

## Overview

The acoustic simulation now uses a **layered configuration system** that separates:
1. **Equipment capabilities** (player progression)
2. **Environmental conditions** (mission/scenario settings)
3. **Runtime calculations** (dynamic state)

This enables both **equipment upgrades** and **environmental variety** without hardcoding values.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│           AcousticContext (Runtime)             │
│  Combines equipment + environment for calcs     │
└──────────────┬──────────────────┬───────────────┘
               │                  │
     ┌─────────▼────────┐  ┌─────▼──────────────┐
     │ SonarEquipment   │  │ EnvironmentConfig  │
     │ (Player gear)    │  │ (Mission setting)  │
     └──────────────────┘  └────────────────────┘
```

---

## 1. Sonar Equipment (SonarEquipment.ts)

### Equipment Progression Tiers

| Tier     | Name              | Era      | Key Features |
|----------|-------------------|----------|--------------|
| BASIC    | AN/BQR-2          | 1960s    | Low resolution, high noise, no windowing |
| STANDARD | AN/BQQ-5          | 1970s-80s| Medium resolution, Hamming windowing |
| ADVANCED | TB-23 + Hull      | 1990s    | Towed array, Blackman windowing, low noise |
| MODERN   | AN/BQQ-10 Digital | 2000s+   | Very high resolution, adaptive processing |

### Configurable Parameters

**Physical Array:**
- `numBeams`: Resolution (360 → 1440)
- `beamSpacing`: Angular resolution (1.0° → 0.25°)
- `beamWidth`: Directivity (5.0° → 2.0°)

**Performance:**
- `directivityIndex`: Array gain (+12 dB → +28 dB)
- `selfNoiseBase`: Self-noise (60 dB → 40 dB)
- `flowNoiseFactor`: Flow noise sensitivity (0.1 → 0.02)

**Processing:**
- `beamformingWindow`: UNIFORM | HAMMING | BLACKMAN | CHEBYSHEV
- `temporalIntegration`: Integration time (0.1s → 1.0s)

**Display:**
- `dynamicRange`: Display range (35 dB → 65 dB)
- `noiseFloorOffset`: Noise floor (18 dB → 5 dB)

### Usage Example

```typescript
import { SONAR_EQUIPMENT } from './config/SonarEquipment';

// Player starts with basic equipment
let playerSonar = SONAR_EQUIPMENT.BASIC;

// Upgrade after mission success
playerSonar = SONAR_EQUIPMENT.STANDARD;

// Late-game equipment
playerSonar = SONAR_EQUIPMENT.MODERN;
```

---

## 2. Environmental Conditions (EnvironmentConfig.ts)

### Pre-defined Environments

| Environment          | Depth | Sea State | Key Challenge |
|---------------------|-------|-----------|---------------|
| North Atlantic      | 4000m | 3         | CZ propagation, moderate noise |
| Mediterranean       | 800m  | 2         | Shallow multi-path, heavy shipping |
| Arctic (Ice)        | 3500m | 0         | Ice noise, surface duct |
| Tropical Pacific    | 5000m | 4         | Snapping shrimp, high biologics |
| Norwegian Sea Storm | 2000m | 6         | Heavy seas, difficult detection |
| Calm Ideal          | 4000m | 0         | Training scenario |

### Configurable Parameters

**Bathymetry:**
- `waterDepth`: Depth in meters
- `deepWater`: Deep vs shallow acoustics

**Surface Conditions:**
- `seaState`: 0-6 (affects ambient noise)
- `surfaceTemperature`: °C (affects absorption)

**Water Column:**
- `soundVelocityProfile`: ISOVELOCITY | SURFACE_DUCT | DEEP_CHANNEL | NEGATIVE_GRADIENT
- `thermoclineDepth`: Thermocline depth (m)
- `channelAxis`: SOFAR channel axis (m)

**Bottom:**
- `bottomType`: SOFT_MUD | SAND | ROCK | BASALT
- `bottomLoss`: Absorption per bounce (dB)

**Ambient Noise:**
- `biologicLevel`: Biologics noise (dB)
- `shippingLevel`: Distant shipping (dB)
- `rainNoise`: High-freq rain noise (boolean)

**Propagation:**
- `convergenceZones`: Enable CZ propagation
- `surfaceDuct`: Trapped shallow propagation
- `bottomBounce`: Bottom bounce paths

### Usage Example

```typescript
import { ENVIRONMENTS } from './config/EnvironmentConfig';

// Select mission environment
const missionEnv = ENVIRONMENTS.MEDITERRANEAN;

// Dynamic weather change
if (stormCondition) {
    currentEnv = ENVIRONMENTS.NORWEGIAN_SEA_STORM;
}
```

---

## 3. Acoustic Context (AcousticContext.ts)

### Purpose

Combines equipment + environment to provide **unified acoustic calculations**.

### Key Methods

```typescript
const context = new AcousticContext(equipment, environment);

// Get total ambient noise (sea state + biologics + shipping)
const ambientNoise = context.getAmbientNoise();

// Calculate transmission loss (with environment-specific propagation)
const tl = context.calculateTransmissionLoss(rangeYards);

// Get effective noise level (ambient + self-noise)
const noiseLevel = context.calculateNoiseLevel(speedKts);

// Get directivity index from equipment
const di = context.getDirectivityIndex();

// Get display parameters
const displayConfig = context.getDisplayConfig();
```

### Propagation Modes

The context automatically selects propagation mode based on environment:

- **SPHERICAL** (deep water): TL = 20·log₁₀(R) + αR
- **CYLINDRICAL** (shallow water): TL = 10·log₁₀(R) + αR
- **SURFACE_DUCT** (trapped): Mixed spreading

### Environmental Effects

- **Temperature correction** on absorption
- **Bottom bounce losses** in shallow water
- **Convergence zone bonuses** in deep water
- **Surface duct** reduced spreading

---

## Integration Example

```typescript
import { SONAR_EQUIPMENT } from './config/SonarEquipment';
import { ENVIRONMENTS } from './config/EnvironmentConfig';
import { AcousticContext } from './lib/AcousticContext';

// Game initialization
const playerEquipment = SONAR_EQUIPMENT.STANDARD;
const missionEnvironment = ENVIRONMENTS.NORTH_ATLANTIC;

// Create acoustic context
const acoustics = new AcousticContext(playerEquipment, missionEnvironment);

// Use in detection calculations
function detectContact(contact, ownship) {
    const range = calculateRange(contact, ownship);

    const tl = acoustics.calculateTransmissionLoss(range);
    const nl = acoustics.calculateNoiseLevel(ownship.speed);
    const di = acoustics.getDirectivityIndex();

    const receivedLevel = contact.sourceLevel - tl;
    const signalExcess = receivedLevel - nl + di;

    return signalExcess > 0; // Detected if SE > 0
}

// Equipment upgrade
function upgradeToAdvancedSonar() {
    playerEquipment = SONAR_EQUIPMENT.ADVANCED;
    acoustics = new AcousticContext(playerEquipment, missionEnvironment);
    // Better DI, lower noise, improved detection ranges
}

// Mission change
function startArcticMission() {
    missionEnvironment = ENVIRONMENTS.ARCTIC;
    acoustics = new AcousticContext(playerEquipment, missionEnvironment);
    // Different propagation, ice noise, surface duct
}
```

---

## Future Enhancements

### Equipment Progression System
- **Unlockable equipment** through campaign progression
- **Cost/reputation system** for upgrades
- **Trade-offs** (resolution vs noise, range vs accuracy)

### Dynamic Environmental Effects
- **Weather changes** mid-mission (storms, ice formation)
- **Time-of-day effects** (biologics, shipping lanes)
- **Seasonal variations** (thermocline depth, biologics)

### Advanced Features
- **Frequency-dependent calculations** (low-freq vs high-freq bands)
- **Multiple array configurations** (hull + towed, flank arrays)
- **Adaptive processing** (MVDR, null steering)
- **Target strength modeling** (aspect-dependent echoes)

---

## Migration Path

Current code can be migrated incrementally:

1. **Phase 1**: Use AcousticContext with default equipment/environment
2. **Phase 2**: Add equipment selection to game state
3. **Phase 3**: Add environment selection to mission system
4. **Phase 4**: Implement progression and unlock system

This preserves existing behavior while enabling future expansion.
