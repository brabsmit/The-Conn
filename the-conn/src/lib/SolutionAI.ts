import { Contact, TrackerSolution } from '../store/types';

/**
 * Generates a noisy solution based on ground truth data.
 * The solution is intentionally degraded by >10% error to act as a starting point (FTOW).
 *
 * @param contact The ground truth contact
 * @param currentTime The current game time (for anchor time)
 * @param ownShip The ownship state (for anchor)
 */
export const generateNoisySolution = (
    contact: Contact,
    currentTime: number,
    ownShip: { x: number; y: number; heading: number }
): TrackerSolution => {
    // 1. Access Truth (Peeking)
    const trueSpeed = contact.speed || 5; // Default to 5 if undefined
    const trueHeading = contact.heading || 0;

    // Calculate True Range/Bearing for initial reference (though we use truth x/y usually)
    const dx = contact.x - ownShip.x;
    const dy = contact.y - ownShip.y;
    const trueRange = Math.sqrt(dx * dx + dy * dy) / 3; // Yards
    const trueBearing = (Math.atan2(dy, dx) * 180 / Math.PI); // Math Angle
    const navBearing = (90 - trueBearing + 360) % 360; // Nav Bearing

    // 2. Error Injection
    // Range Error: Fixed +/- 15%
    const rangeError = Math.random() > 0.5 ? 0.15 : -0.15;
    const noisyRange = trueRange * (1.0 + rangeError);

    // Speed Error: +/- 10%
    const speedError = Math.random() > 0.5 ? 0.1 : -0.1;
    const noisySpeed = Math.max(1, trueSpeed * (1.0 + speedError));

    // Course Error: +/- 10 degrees (Random * 20 - 10)
    const courseError = (Math.random() * 20) - 10;
    const noisyCourse = (trueHeading + courseError + 360) % 360;

    // 3. Construct Solution
    // We need to compute the world position based on the noisy range/bearing from OwnShip
    // Bearing is usually relatively accurate from sensors, but let's use the True Bearing for the solution anchor
    // (or maybe add slight bearing error? Prompt doesn't specify bearing error, just Speed, Course, Range)

    // Calculate Computed World Position based on Noisy Range + True Bearing (approx)
    // computedWorldX/Y is where the target IS at anchorTime.
    const bearingRad = (navBearing * Math.PI) / 180;
    const noisyDistFt = noisyRange * 3;

    const computedX = ownShip.x + noisyDistFt * Math.sin(bearingRad);
    const computedY = ownShip.y + noisyDistFt * Math.cos(bearingRad);

    return {
        speed: noisySpeed,
        range: noisyRange,
        course: noisyCourse,
        bearing: navBearing,
        anchorTime: currentTime,
        anchorOwnShip: { ...ownShip },
        computedWorldX: computedX,
        computedWorldY: computedY
    };
};
