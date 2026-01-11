import { useSubmarineStore } from '../store/useSubmarineStore';
import type { Contact, Tracker } from '../store/useSubmarineStore';
import { CONTACT_TYPES } from '../config/ContactDatabase';

export const loadAmbushScenario = () => {
    const store = useSubmarineStore.getState();

    // 1. Ownship
    // Heading 000, Speed 5kts. Position (0,0) for simplicity.
    const ownShip = {
        x: 0,
        y: 0,
        heading: 0,
        speed: 5,
        depth: 150, // Standard operating depth
        orderedHeading: 0,
        orderedSpeed: 5,
        orderedDepth: 150
    };

    // 2. Merchant (S-1)
    // Range 8,000yds, Bearing 045, Speed 12kts.
    // Bearing 045 relative to (0,0) -> 45 deg True.
    // X = R * sin(theta), Y = R * cos(theta) (Nav convention)
    const s1Range = 8000;
    const s1BearingRad = (45 * Math.PI) / 180;
    const s1X = s1Range * Math.sin(s1BearingRad);
    const s1Y = s1Range * Math.cos(s1BearingRad);

    const merchantSpec = CONTACT_TYPES.MERCHANT;
    // Task 151: Dynamic Variation (+/- 3dB)
    const mVariance = (Math.random() * 6) - 3;

    const merchant: Contact = {
        id: 'Sierra-1',
        x: s1X,
        y: s1Y,
        heading: 90, // Crossing
        speed: 12,
        type: 'NEUTRAL', // Assuming merchant is neutral or enemy merchant? Task says "Merchant". Usually neutral, but can be target. Store defaults "ENEMY" | "NEUTRAL".
        classification: 'MERCHANT',
        sourceLevel: merchantSpec.acoustics.baseSL + mVariance, // Task 151: 135 +/- 3
        baseSourceLevel: merchantSpec.acoustics.baseSL,
        cavitationSpeed: 10, // Cavitates early
        status: 'ACTIVE'
    };

    // 3. Enemy Sub (S-2)
    // Range 9,000yds, Bearing 050, Speed 5kts (Quiet/Smart).
    const s2Range = 9000;
    const s2BearingRad = (50 * Math.PI) / 180;
    const s2X = s2Range * Math.sin(s2BearingRad);
    const s2Y = s2Range * Math.cos(s2BearingRad);

    const subSpec = CONTACT_TYPES.SUB;
    const sVariance = (Math.random() * 6) - 3;

    const enemySub: Contact = {
        id: 'Sierra-2',
        x: s2X,
        y: s2Y,
        heading: 90, // Shadowing merchant
        speed: 5,
        type: 'ENEMY',
        classification: 'SUB',
        sourceLevel: subSpec.acoustics.baseSL + sVariance, // Task 151: 105 +/- 3
        baseSourceLevel: subSpec.acoustics.baseSL,
        cavitationSpeed: 20, // Good screw
        aiMode: 'IDLE',
        sensitivity: 300000000, // Tuned for detection
        status: 'ACTIVE'
    };

    // Pre-calculated Trackers
    const tracker1: Tracker = {
        id: 'S1',
        contactId: 'Sierra-1',
        currentBearing: 45,
        displayBearing: 45,
        bearingHistory: [],
        solution: {
            legs: [{
                startTime: 0,
                startRange: 8000,
                startBearing: 45,
                course: 90,
                speed: 10,
                startOwnShip: { x: 0, y: 0, heading: 0 }
            }],
            speed: 10,
            range: 8000,
            course: 90,
            bearing: 45,
            anchorTime: 0,
            anchorOwnShip: { x: 0, y: 0, heading: 0 },
            computedWorldX: s1X, // Using known truth for computed
            computedWorldY: s1Y
        },
        classificationStatus: 'PENDING',
        timeToClassify: 2 // Fast classify for testing
    };

    const tracker2: Tracker = {
        id: 'S2',
        contactId: 'Sierra-2',
        currentBearing: 50,
        displayBearing: 50,
        bearingHistory: [],
        solution: {
            legs: [{
                startTime: 0,
                startRange: 9000,
                startBearing: 50,
                course: 90,
                speed: 5,
                startOwnShip: { x: 0, y: 0, heading: 0 }
            }],
            speed: 5,
            range: 9000,
            course: 90,
            bearing: 50,
            anchorTime: 0,
            anchorOwnShip: { x: 0, y: 0, heading: 0 },
            computedWorldX: s2X,
            computedWorldY: s2Y
        },
        classificationStatus: 'PENDING',
        timeToClassify: 5 // Slightly slower than S1
    };


    // Reset Store
    store.loadScenario({
        ...ownShip,
        contacts: [merchant, enemySub],
        trackers: [tracker1, tracker2], // Pre-load trackers
        ownShipHistory: [],
        sensorReadings: [],
        torpedoes: [],
        transients: [],
        activeStation: 'TMA'
    });
};
