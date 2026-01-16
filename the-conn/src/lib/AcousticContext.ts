/**
 * Acoustic Context
 * Combines sonar equipment and environmental conditions
 * Provides unified interface for acoustic calculations
 */

import type { SonarArrayConfig } from '../config/SonarEquipment';
import type { EnvironmentConfig } from '../config/EnvironmentConfig';
import { ACOUSTICS } from '../config/AcousticConstants';

export class AcousticContext {
    public equipment: SonarArrayConfig;
    public environment: EnvironmentConfig;

    constructor(equipment: SonarArrayConfig, environment: EnvironmentConfig) {
        this.equipment = equipment;
        this.environment = environment;
    }

    /**
     * Get total ambient noise level (environment + biologics + shipping)
     */
    getAmbientNoise(): number {
        // Base sea state noise
        const seaStateNoise = ACOUSTICS.ENVIRONMENT.SEA_STATE_NOISE[this.environment.seaState];

        // Add environmental noise sources (power domain addition)
        const seaStatePower = Math.pow(10, seaStateNoise / 10);
        const biologicPower = Math.pow(10, this.environment.biologicLevel / 10);
        const shippingPower = Math.pow(10, this.environment.shippingLevel / 10);

        // Rain noise (high frequency, ~+5 dB if present)
        const rainPower = this.environment.rainNoise ? Math.pow(10, 5 / 10) : 0;

        const totalPower = seaStatePower + biologicPower + shippingPower + rainPower;
        return 10 * Math.log10(totalPower);
    }

    /**
     * Get absorption coefficient (frequency dependent)
     */
    getAbsorptionCoeff(): number {
        // Base coefficient (100-1000 Hz passive sonar band)
        let alpha = ACOUSTICS.ENVIRONMENT.ABSORPTION_COEFF;

        // Temperature correction (warmer water = lower absorption)
        const tempCorrection = 1.0 - ((this.environment.surfaceTemperature - 15) * 0.01);
        alpha *= tempCorrection;

        return alpha;
    }

    /**
     * Get transmission loss mode based on environment
     */
    getTransmissionLossMode(): 'SPHERICAL' | 'CYLINDRICAL' | 'SURFACE_DUCT' {
        if (this.environment.surfaceDuct && !this.environment.deepWater) {
            return 'SURFACE_DUCT';
        } else if (!this.environment.deepWater && this.environment.bottomBounce) {
            return 'CYLINDRICAL';
        }
        return 'SPHERICAL';
    }

    /**
     * Calculate transmission loss with environmental effects
     */
    calculateTransmissionLoss(rangeYards: number): number {
        const r = Math.max(1, rangeYards);
        const alpha = this.getAbsorptionCoeff();
        const mode = this.getTransmissionLossMode();

        let spreading = 0;

        // Spreading loss depends on propagation mode
        switch (mode) {
            case 'SPHERICAL':
                // Deep water: 20*log10(R)
                spreading = 20 * Math.log10(r);
                break;

            case 'CYLINDRICAL':
                // Shallow water (bottom bounce): 10*log10(R)
                spreading = 10 * Math.log10(r);
                break;

            case 'SURFACE_DUCT':
                // Surface duct: reduced spreading at short range
                if (r < 10000) {
                    spreading = 10 * Math.log10(r);
                } else {
                    // Transition to spherical at long range
                    spreading = 10 * Math.log10(10000) + 20 * Math.log10(r / 10000);
                }
                break;
        }

        // Absorption loss
        const absorption = alpha * r;

        let tl = spreading + absorption;

        // Bottom bounce loss (shallow water)
        if (this.environment.bottomBounce && !this.environment.deepWater) {
            const numBounces = Math.floor(r / (this.environment.waterDepth * 2));
            tl += numBounces * this.environment.bottomLoss;
        }

        // Convergence zones (deep water only)
        if (this.environment.convergenceZones && this.environment.deepWater) {
            if (r >= ACOUSTICS.ENVIRONMENT.CZ_RANGE_MIN && r <= ACOUSTICS.ENVIRONMENT.CZ_RANGE_MAX) {
                tl -= ACOUSTICS.ENVIRONMENT.CZ_BONUS;
            }
        }

        return tl;
    }

    /**
     * Get effective noise level (ambient + self-noise)
     */
    calculateNoiseLevel(speedKts: number): number {
        const ambientNoise = this.getAmbientNoise();

        // Self-noise using equipment characteristics
        const baseSN = this.equipment.selfNoiseBase;
        const flowFactor = this.equipment.flowNoiseFactor;
        let sn = baseSN + (speedKts * speedKts * flowFactor);

        // Cavitation (same for all equipment)
        const cavitationSpeed = 18;
        if (speedKts > cavitationSpeed) {
            const excessSpeed = speedKts - cavitationSpeed;
            const cavitationNoise = Math.min(40, excessSpeed * excessSpeed * 0.3);
            sn += cavitationNoise;
        }

        // Combine ambient and self-noise (power domain)
        const anPower = Math.pow(10, ambientNoise / 10);
        const snPower = Math.pow(10, sn / 10);

        return 10 * Math.log10(anPower + snPower);
    }

    /**
     * Get directivity index from equipment
     */
    getDirectivityIndex(): number {
        return this.equipment.directivityIndex;
    }

    /**
     * Get display parameters from equipment
     */
    getDisplayConfig() {
        return {
            dynamicRange: this.equipment.dynamicRange,
            noiseFloorOffset: this.equipment.noiseFloorOffset,
            numBeams: this.equipment.numBeams,
            beamSpacing: this.equipment.beamSpacing,
            beamWidth: this.equipment.beamWidth,
        };
    }
}
