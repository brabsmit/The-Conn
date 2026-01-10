import { useSubmarineStore } from '../store/useSubmarineStore';
import type { Contact, Tracker } from '../store/useSubmarineStore';

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

    const merchant: Contact = {
        id: 'Sierra-1',
        x: s1X,
        y: s1Y,
        heading: 90, // Crossing
        speed: 12,
        type: 'NEUTRAL', // Assuming merchant is neutral or enemy merchant? Task says "Merchant". Usually neutral, but can be target. Store defaults "ENEMY" | "NEUTRAL".
        classification: 'MERCHANT',
        sourceLevel: 155, // Task 117.1: Loud (Absolute dB)
        cavitationSpeed: 10, // Cavitates early
        status: 'ACTIVE'
    };

    // 3. Enemy Sub (S-2)
    // Range 9,000yds, Bearing 050, Speed 5kts (Quiet/Smart).
    const s2Range = 9000;
    const s2BearingRad = (50 * Math.PI) / 180;
    const s2X = s2Range * Math.sin(s2BearingRad);
    const s2Y = s2Range * Math.cos(s2BearingRad);

    const enemySub: Contact = {
        id: 'Sierra-2',
        x: s2X,
        y: s2Y,
        heading: 90, // Shadowing merchant
        speed: 5,
        type: 'ENEMY',
        classification: 'SUB',
        sourceLevel: 120, // Task 117.1: Quiet (Absolute dB)
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
        bearingHistory: [],
        solution: {
            speed: 10,
            range: 8000,
            course: 90,
            bearing: 45,
            anchorTime: 0,
            anchorOwnShip: { x: 0, y: 0, heading: 0 }
        },
        classificationStatus: 'PENDING',
        timeToClassify: 2 // Fast classify for testing
    };

    const tracker2: Tracker = {
        id: 'S2',
        contactId: 'Sierra-2',
        currentBearing: 50,
        bearingHistory: [],
        solution: {
            speed: 5,
            range: 9000,
            course: 90,
            bearing: 50,
            anchorTime: 0,
            anchorOwnShip: { x: 0, y: 0, heading: 0 }
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
