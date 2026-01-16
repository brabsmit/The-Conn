# Acoustic Tuning Panel

## Overview

The **Acoustic Tuning Panel** provides runtime controls for all acoustic parameters, enabling:
- Equipment selection (sonar array progression)
- Environment scenarios (mission conditions)
- Contact source level adjustments (gameplay balancing)
- Ownship parameter tuning (speed, noise)

Perfect for testing, balancing, and experimenting with sonar display behavior.

---

## Quick Start

### 1. Add to Your Game UI

```tsx
import { AcousticTuningPanel } from './components/debug/AcousticTuningPanel';
import { useAcousticTuning } from './hooks/useAcousticTuning';

function YourGameScreen() {
    const {
        handleEquipmentChange,
        handleEnvironmentChange,
        handleSourceLevelAdjust,
        handleSeaStateChange,
        handleSpeedChange,
    } = useAcousticTuning();

    return (
        <div>
            {/* Your existing game UI */}

            {/* Add tuning panel (dev mode only recommended) */}
            {process.env.NODE_ENV === 'development' && (
                <AcousticTuningPanel
                    onEquipmentChange={handleEquipmentChange}
                    onEnvironmentChange={handleEnvironmentChange}
                    onSourceLevelAdjust={handleSourceLevelAdjust}
                    onSeaStateChange={handleSeaStateChange}
                    onSpeedChange={handleSpeedChange}
                />
            )}
        </div>
    );
}
```

### 2. Enable with Keyboard Shortcut (Optional)

```tsx
import { useState, useEffect } from 'react';

function YourGameScreen() {
    const [showTuning, setShowTuning] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'F9') {
                setShowTuning(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    return (
        <div>
            {showTuning && (
                <AcousticTuningPanel {...handlers} />
            )}
        </div>
    );
}
```

---

## Features

### Equipment Tab

**Select Sonar System:**
- BASIC (AN/BQR-2) - 1960s basic array
- STANDARD (AN/BQQ-5) - 1970s-80s workhorse
- ADVANCED (TB-23) - 1990s towed array
- MODERN (AN/BQQ-10) - 2000s+ digital

**Displays:**
- Beam resolution and spacing
- Directivity Index (array gain)
- Self-noise characteristics
- Beamforming window type
- Dynamic range

**Try This:**
- Switch from BASIC to MODERN to see detection range improvement
- Compare BASIC (loud) vs ADVANCED (quiet) self-noise
- Observe side lobe changes with different beamforming

---

### Environment Tab

**Select Mission Environment:**
- North Atlantic - Classic deep water, CZ propagation
- Mediterranean - Shallow, heavy shipping noise
- Arctic - Ice noise, surface duct propagation
- Tropical Pacific - High biologics (snapping shrimp)
- Norwegian Sea Storm - Heavy weather, difficult detection
- Calm Ideal - Perfect training conditions

**Displays:**
- Water depth and propagation mode
- Sea state and ambient noise
- Biologics and shipping levels
- Sound velocity profile
- Bottom characteristics

**Runtime Override:**
- Sea State slider (0-6)
- Instantly change weather conditions
- See real-time noise level updates

**Try This:**
- Compare CALM_IDEAL (easy) vs NORWEGIAN_SEA_STORM (hard)
- Test TROPICAL_PACIFIC to experience high biologic noise
- Use sea state slider to simulate storm approaching

---

### Contacts Tab

**Adjust Source Levels:**
- MERCHANT: ±1 dB or ±5 dB adjustments
- TRAWLER: Fine-tune contact loudness
- ESCORT: Balance warship detectability
- SUB: Adjust submarine stealth
- TORPEDO: Control weapon signature
- BIOLOGIC: Tune false contact rate

**Try This:**
- Make submarines quieter (-5 dB) for harder gameplay
- Increase merchant traffic (+5 dB) for easier initial detection
- Reduce torpedo noise for stealthy wire-guided weapons

---

### Ownship Tab

**Control Own Submarine:**
- Speed slider (0-30 knots)
- Real-time self-noise calculation
- Cavitation warning (>18 knots)
- Flow noise visualization

**Displays:**
- Self-noise base (from equipment)
- Flow noise (speed² × factor)
- Cavitation penalty (quadratic above 18 knots)
- Total self-noise level

**Try This:**
- Slowly increase speed to see noise ramp up
- Cross 18 knots to see cavitation penalty
- Compare self-noise with different equipment (BASIC vs MODERN)

---

## Console Logging

All changes are logged to console for debugging:

```
[Acoustic Tuning] Equipment changed to: AN/BQQ-10 Digital Sonar
  - Directivity Index: +28 dB
  - Self-Noise Base: 40 dB
  - Beam Resolution: 1440 beams
  - Beamforming: CHEBYSHEV

[Acoustic Tuning] Environment changed to: Arctic Ocean (Ice Cover)
  - Water Depth: 3500m
  - Sea State: 0
  - Biologics: -5 dB
  - Shipping: -10 dB

[Acoustic Tuning] SUB source level adjusted:
  Base: 105 dB
  Adjustment: -5 dB
  New Level: 100 dB
```

---

## Event System

The tuning panel dispatches custom events that can be intercepted:

```typescript
window.addEventListener('acoustic-config-changed', (event: CustomEvent) => {
    const { type, value, contactType } = event.detail;

    switch (type) {
        case 'equipment':
            // Update SonarArray configuration
            updateEquipment(value);
            break;

        case 'environment':
            // Update environmental calculations
            updateEnvironment(value);
            break;

        case 'sourceLevel':
            // Update contact source levels
            updateContactSourceLevels(contactType, value);
            break;

        case 'seaState':
            // Update ambient noise
            updateSeaState(value);
            break;
    }
});
```

---

## Usage Patterns

### Gameplay Testing

```typescript
// Test detection ranges
1. Set equipment to BASIC
2. Set environment to NORWEGIAN_SEA_STORM
3. Adjust submarine source to -5 dB
4. Try to detect at various ranges
5. Compare with MODERN equipment

// Test speed stealth
1. Use Ownship tab speed slider
2. Observe self-noise at 5 knots (quiet)
3. Increase to 15 knots (moderate flow noise)
4. Cross 18 knots (cavitation penalty)
5. See effect on sonar display background noise
```

### Balance Tuning

```typescript
// Find optimal difficulty
1. Start with STANDARD equipment
2. Use NORTH_ATLANTIC environment
3. Adjust contact source levels:
   - Merchants: +2 dB (easier to find)
   - Subs: -3 dB (harder to detect)
   - Torpedoes: 0 dB (keep as is)
4. Test gameplay feel
5. Iterate until balanced
```

### Environment Comparison

```typescript
// See environmental impact
1. Load same scenario
2. Switch environments:
   - CALM_IDEAL: Maximum detection range
   - MEDITERRANEAN: Shallow water, shipping noise
   - TROPICAL_PACIFIC: Biologics masking
   - ARCTIC: Ice noise, different propagation
3. Note detection range differences
```

---

## Styling

The panel uses a **retro green monospace terminal aesthetic** matching sonar displays:
- Green-on-black color scheme
- Monospace font
- Collapsible for minimal screen impact
- Fixed position (top-right)
- Tabbed interface for organization

Customize styles in `AcousticTuningPanel.tsx` if needed.

---

## Future Enhancements

Potential additions:
- **Presets**: Save/load acoustic configurations
- **Real-time graphs**: Plot detection ranges vs parameters
- **Scenario recording**: Record tuning sessions for later review
- **Multi-contact test**: Spawn test contacts at specific ranges/bearings
- **Frequency bands**: Control low-freq vs high-freq characteristics
- **Array geometry**: Visualize beam patterns in real-time

---

## Performance

**Lightweight:**
- Minimal rendering (React state updates only)
- No performance impact when collapsed
- Event-driven updates (no polling)
- Console logging can be disabled in production

**Recommended:**
- Development builds only (guard with `process.env.NODE_ENV`)
- Or use F9 toggle for on-demand activation
- Collapse when not in use

---

## Integration Checklist

- [ ] Import `AcousticTuningPanel` component
- [ ] Import `useAcousticTuning` hook
- [ ] Add panel to game UI
- [ ] Wire up event handlers
- [ ] Test equipment switching
- [ ] Test environment switching
- [ ] Test contact source level adjustments
- [ ] Test ownship speed control
- [ ] Add keyboard shortcut (optional)
- [ ] Verify console logging
- [ ] Test collapsible behavior

Enjoy experimenting with the acoustic simulation! 🎛️
