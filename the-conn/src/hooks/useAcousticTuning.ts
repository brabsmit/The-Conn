/**
 * useAcousticTuning Hook
 * Provides runtime control over acoustic parameters
 * Integrates tuning panel with game state
 */

import { useCallback } from 'react';
import { useSubmarineStore } from '../store/useSubmarineStore';
import { SONAR_EQUIPMENT } from '../config/SonarEquipment';
import { ENVIRONMENTS } from '../config/EnvironmentConfig';
import { ACOUSTICS } from '../config/AcousticConstants';

// Runtime overrides (stored in module scope for persistence)
let equipmentOverride = 'STANDARD';
let environmentOverride = 'NORTH_ATLANTIC';
let seaStateOverride = 3;
let sourceLevelAdjustments: Record<string, number> = {};

export function useAcousticTuning() {
    const setSpeed = useSubmarineStore((state) => state.setOrderedSpeed);

    const handleEquipmentChange = useCallback((equipmentId: string) => {
        equipmentOverride = equipmentId;
        const equipment = SONAR_EQUIPMENT[equipmentId];

        console.log(`[Acoustic Tuning] Equipment changed to: ${equipment.name}`);
        console.log(`  - Directivity Index: +${equipment.directivityIndex} dB`);
        console.log(`  - Self-Noise Base: ${equipment.selfNoiseBase} dB`);
        console.log(`  - Beam Resolution: ${equipment.numBeams} beams`);
        console.log(`  - Beamforming: ${equipment.beamformingWindow}`);

        // Force refresh by triggering state update
        // In the future, this would update SonarArray and AcousticsEngine config
        window.dispatchEvent(new CustomEvent('acoustic-config-changed', {
            detail: { type: 'equipment', value: equipmentId }
        }));
    }, []);

    const handleEnvironmentChange = useCallback((environmentId: string) => {
        environmentOverride = environmentId;
        const environment = ENVIRONMENTS[environmentId];

        console.log(`[Acoustic Tuning] Environment changed to: ${environment.name}`);
        console.log(`  - Water Depth: ${environment.waterDepth}m`);
        console.log(`  - Sea State: ${environment.seaState}`);
        console.log(`  - Biologics: ${environment.biologicLevel > 0 ? '+' : ''}${environment.biologicLevel} dB`);
        console.log(`  - Shipping: ${environment.shippingLevel > 0 ? '+' : ''}${environment.shippingLevel} dB`);

        window.dispatchEvent(new CustomEvent('acoustic-config-changed', {
            detail: { type: 'environment', value: environmentId }
        }));
    }, []);

    const handleSourceLevelAdjust = useCallback((contactType: string, delta: number) => {
        // Track cumulative adjustments
        const currentAdjustment = sourceLevelAdjustments[contactType] || 0;
        const newAdjustment = currentAdjustment + delta;
        sourceLevelAdjustments[contactType] = newAdjustment;

        const baseLevel = ACOUSTICS.SOURCE_LEVELS[contactType as keyof typeof ACOUSTICS.SOURCE_LEVELS];
        const newLevel = baseLevel + newAdjustment;

        console.log(`[Acoustic Tuning] ${contactType} source level adjusted:`);
        console.log(`  Base: ${baseLevel} dB`);
        console.log(`  Adjustment: ${newAdjustment > 0 ? '+' : ''}${newAdjustment} dB`);
        console.log(`  New Level: ${newLevel} dB`);

        // Update all contacts of this type
        // This would require access to contacts and update their sourceLevel
        window.dispatchEvent(new CustomEvent('acoustic-config-changed', {
            detail: { type: 'sourceLevel', contactType, value: newLevel }
        }));
    }, []);

    const handleSeaStateChange = useCallback((seaState: number) => {
        seaStateOverride = seaState;

        const noiseLevel = ACOUSTICS.ENVIRONMENT.SEA_STATE_NOISE[seaState];
        console.log(`[Acoustic Tuning] Sea state changed to: ${seaState}`);
        console.log(`  - Ambient Noise: ${noiseLevel} dB`);

        window.dispatchEvent(new CustomEvent('acoustic-config-changed', {
            detail: { type: 'seaState', value: seaState }
        }));
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
        console.log(`[Acoustic Tuning] Ordered speed changed to: ${speed} knots`);
        setSpeed(speed);
    }, [setSpeed]);

    return {
        handleEquipmentChange,
        handleEnvironmentChange,
        handleSourceLevelAdjust,
        handleSeaStateChange,
        handleSpeedChange,
        getCurrentConfig: () => ({
            equipment: equipmentOverride,
            environment: environmentOverride,
            seaState: seaStateOverride,
            sourceLevelAdjustments,
        }),
    };
}

// Export getters for current config (can be used by other systems)
export const getCurrentEquipment = () => SONAR_EQUIPMENT[equipmentOverride];
export const getCurrentEnvironment = () => ENVIRONMENTS[environmentOverride];
export const getCurrentSeaState = () => seaStateOverride;
export const getSourceLevelAdjustment = (contactType: string) => sourceLevelAdjustments[contactType] || 0;
