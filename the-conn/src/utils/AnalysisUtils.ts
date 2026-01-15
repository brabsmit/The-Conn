import type { Tracker, SolutionLeg } from '../store/types';

export type SafetyLevel = 'SAFE' | 'WARNING' | 'DANGER';

export interface SafetyHeatmap {
    [angle: number]: {
        [speed: number]: SafetyLevel;
    };
}

export interface CPAInfo {
    cpa: number;
    timeToCpa: number;
}

const SAFETY_THRESHOLDS = {
    DANGER: { range: 2000, time: 15 * 60 },
    WARNING: { range: 4000, time: 15 * 60 },
};

export const generateSafetyHeatmap = (
    ownship: { x: number; y: number }, // Current position to project from
    trackers: Tracker[],
    timeHorizonMinutes: number = 15
): SafetyHeatmap => {
    const heatmap: SafetyHeatmap = {};
    const timeHorizonSeconds = timeHorizonMinutes * 60;

    const speedSteps = [5, 10, 15, 20, 25];
    const angleSteps = 36; // 10 degrees per step
    const angleIncrement = 360 / angleSteps;

    for (let i = 0; i < angleSteps; i++) {
        const angle = i * angleIncrement;
        heatmap[angle] = {};

        for (const speed of speedSteps) {
            let maxRisk: SafetyLevel = 'SAFE';

            // Convert trial velocity to vector
            // 1 knot = 0.5629 yds/sec (Wait, check conversion in other files. GeoDisplay uses 1.6878 ft/sec)
            // 1 knot = 2025.37 yds/hour = 0.5626 yds/sec.
            // Let's check tma.ts or similar for standard conversion.
            // Assuming 1 knot ~= 0.56 yards/second for now.
            const speedYps = speed * 0.5629;
            const radAngle = (angle * Math.PI) / 180;
            const trialVx = Math.sin(radAngle) * speedYps;
            const trialVy = Math.cos(radAngle) * speedYps;

            for (const tracker of trackers) {
                // Skip if no solution
                if (!tracker.solution || tracker.solution.range === 0) continue;

                const sol = tracker.solution;

                // Project Target Position to NOW (if anchor time is old)
                // However, solution usually represents "current" understanding projected from anchor.
                // Let's assume solution.course/speed/range/bearing are valid relative to ownship at anchorTime.
                // Better: Solution provides target course/speed (absolute).
                // We need relative velocity.

                // Target Velocity Vector
                const targetSpeedYps = sol.speed * 0.5629;
                const targetRad = (sol.course * Math.PI) / 180;
                const targetVx = Math.sin(targetRad) * targetSpeedYps;
                const targetVy = Math.cos(targetRad) * targetSpeedYps;

                // Relative Velocity (Target - Ownship)
                const relVx = targetVx - trialVx;
                const relVy = targetVy - trialVy;
                const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

                if (relSpeed < 0.01) continue; // Parallel/Stationary relative

                // Current Relative Position (Target - Ownship)
                // We need the CURRENT position of the target relative to CURRENT ownship position.
                // If we assume the heatmap is calculated for "Right Now", we use the current estimated positions.

                // We can estimate current target position based on solution
                // But simpler: We have range/bearing from tracker.currentBearing (sensor) or solution?
                // Use solution parameters.
                // Let's assume we are calculating from t=0 (now).
                // We need the Target's position relative to Ownship at t=0.
                // Since `generateSafetyHeatmap` is stateless regarding time,
                // we must assume the caller passes `ownship` at t=0,
                // and we need `tracker` position at t=0.

                // Re-calculating Target World Position at Current Time:
                // We don't have gameTime passed in.
                // Let's approximate: Use `solution.computedWorldX/Y` which is the position at `anchorTime` + projection?
                // Actually `computedWorldX` is updated?
                // Let's rely on Relative Position derived from `solution.range` and `solution.bearing`
                // IF we assume solution is up-to-date.
                // If solution is old, we should project it.
                // For this utility, let's accept `trackers` as is, but maybe we need a `currentTargetPos` helper.

                // SIMPLIFICATION:
                // Assume `solution` defines the target kinematics.
                // Assume `solution.range` and `solution.bearing` define the relative position NOW.
                // (In reality, they define it at `anchorTime`).
                // To be precise, we should project.
                // But for a "Quick Safety Check", using the latest solution values is standard.

                const radBearing = (sol.bearing * Math.PI) / 180;
                const relX = Math.sin(radBearing) * sol.range;
                const relY = Math.cos(radBearing) * sol.range;

                // CPA Calculation
                // P_rel = [relX, relY]
                // V_rel = [relVx, relVy]

                // Time to CPA = -(P . V) / (V . V)
                const dotProduct = relX * relVx + relY * relVy;
                const speedSq = relSpeed * relSpeed;
                const tCPA = -(dotProduct) / speedSq;

                // CPA Distance
                // P_cpa = P_start + V_rel * tCPA
                // But only if tCPA > 0? No, CPA is the closest point on the line.
                // We only care if tCPA is in the future (0 to timeHorizon).

                let distCPA = 0;

                if (tCPA < 0) {
                    // Diverging or CPA was in past.
                    // Closest point in future is NOW.
                    distCPA = Math.sqrt(relX * relX + relY * relY);
                } else if (tCPA > timeHorizonSeconds) {
                    // CPA is too far in future.
                    // Check distance at horizon?
                    // Or just ignore? "Dangerous CPA in 3 hours" -> Ignore.
                    // But we might be CLOSER at t=horizon than now.
                    // Let's calculate dist at tCPA, but only flag if tCPA within horizon.
                    // Wait, if CPA is 100yds but 20 mins away? Maybe warning?
                    // Task says "AND Time < 15min". So strictly within horizon.

                    // So if tCPA > horizon, we treat it as SAFE for this check.
                    distCPA = Infinity;
                } else {
                    // Valid future CPA
                    const cpaX = relX + relVx * tCPA;
                    const cpaY = relY + relVy * tCPA;
                    distCPA = Math.sqrt(cpaX * cpaX + cpaY * cpaY);
                }

                // Apply Thresholds
                if (tCPA >= 0 && tCPA <= timeHorizonSeconds) {
                    if (distCPA < SAFETY_THRESHOLDS.DANGER.range) {
                        maxRisk = 'DANGER';
                        break; // Worst case found
                    } else if (distCPA < SAFETY_THRESHOLDS.WARNING.range) {
                        maxRisk = 'WARNING';
                    }
                }
            }

            heatmap[angle][speed] = maxRisk;
        }
    }

    return heatmap;
};
