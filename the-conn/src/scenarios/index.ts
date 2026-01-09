import type { SubmarineState, Contact } from '../store/useSubmarineStore';

// Helper to create basic contact
const createContact = (id: string, x: number, y: number, classification: any, type: 'ENEMY' | 'NEUTRAL', speed: number, heading: number): Contact => ({
    id,
    x,
    y,
    classification,
    type,
    speed,
    heading,
    depth: 50,
    sourceLevel: 1.0,
    cavitationSpeed: 10,
    status: 'ACTIVE',
    history: [],
    aiMode: type === 'ENEMY' ? 'PATROL' : undefined,
    aiDisabled: false,
    aiReactionTimer: undefined,
    canDetectTorpedoes: type === 'ENEMY'
});

export const scenarios = [
    {
        id: 'sc1',
        title: "Safety of Navigation",
        description: "Dense shipping lane. Avoid collision. 30 Minutes survival.",
        setup: (): Partial<SubmarineState> => {
            const contacts: Contact[] = [];

            // 1. Define the Transit Lane Geometry
            const laneHeading = Math.random() * 360; // The direction of the "Highway"
            const laneWidth = 4000; // 4,000yd wide highway
            const laneOffset = (Math.random() - 0.5) * 6000; // The lane center might be up to 3k yds left or right of ownship

            // 2. Spawn 4-5 Merchants
            const numMerchants = 4;

            for (let i = 0; i < numMerchants; i++) {
                // A. Generate Position in "Lane Space" (Relative to the highway axis)
                // Cross-Track: Randomly place them within the lane width
                const crossTrack = laneOffset + ((Math.random() - 0.5) * laneWidth);
                
                // Along-Track: Distribute them along the length of the lane (-30k to +30k)
                let alongTrack = (Math.random() - 0.5) * 60000;

                // B. The 10,000yd Safety Guard
                // Calculate current distance from center (0,0) in lane space
                const dist = Math.sqrt(crossTrack * crossTrack + alongTrack * alongTrack);
                
                // If too close, push them out along the track
                if (dist < 10000) {
                    // Push them 10k yds away in whichever direction they were already leaning
                    const pushDir = alongTrack > 0 ? 1 : -1;
                    alongTrack = (10000 + Math.random() * 5000) * pushDir;
                }

                // C. Rotate "Lane Space" to "World Space" (Navigation Math)
                // Convert Heading to Radians
                const rads = (laneHeading * Math.PI) / 180;
                
                // Rotate the point (Standard Rotation Matrix for Nav coordinates)
                // X = Cross * Cos(Hdg) + Along * Sin(Hdg)
                // Y = -Cross * Sin(Hdg) + Along * Cos(Hdg)
                // (Note: This is a simplified rotation assuming CrossTrack is X-axis relative)
                
                // Easier Method: Polar Conversion
                // 1. Bearing from Center to Point
                const bearingToPoint = (Math.atan2(crossTrack, alongTrack) * 180 / Math.PI); 
                // 2. Rotate that bearing by the Lane Heading
                const finalBearing = (laneHeading + bearingToPoint + 360) % 360;
                // 3. Final Distance
                const finalDist = Math.sqrt(crossTrack*crossTrack + alongTrack*alongTrack);
                
                const worldX = finalDist * Math.sin(finalBearing * Math.PI / 180);
                const worldY = finalDist * Math.cos(finalBearing * Math.PI / 180);

                // D. Determine Course (With Traffic Flow)
                // 50% chance to follow lane, 50% chance to be reciprocal
                const isReciprocal = Math.random() > 0.5;
                const course = isReciprocal ? (laneHeading + 180) % 360 : laneHeading;

                // E. Speed (15 +/- 5) -> Random(10, 20)
                const speed = 10 + Math.random() * 10;

                contacts.push(createContact(
                    `M-${i + 1}`,
                    worldX,
                    worldY,
                    'MERCHANT',
                    'NEUTRAL',
                    speed,
                    course
                ));
            }
            // 3. Define the Trawler Field (The "Obstacle")
            // Pick a center point for the fleet that is GUARANTEED to be safe.
            // Safety Buffer: We want the edge of the field to be > 8000yds away.
            // So the Center must be > (8000 + FieldRadius) away.
            const fieldRadius = 4000; // The fleet covers an 8k diameter circle
            const minCenterDist = 8000 + fieldRadius; // ~12,000 yds

            const fieldBearing = Math.random() * 360;
            const fieldRange = minCenterDist + (Math.random() * 10000); // 12k to 22k yards out

            const fieldCenterX = fieldRange * Math.sin(fieldBearing * Math.PI / 180);
            const fieldCenterY = fieldRange * Math.cos(fieldBearing * Math.PI / 180);

            // Spawn 4-5 Trawlers inside this zone
            const numTrawlers = 4;

            for (let i = 0; i < numTrawlers; i++) {
                // Random point inside the Field Radius
                const r = Math.sqrt(Math.random()) * fieldRadius; // Sqrt for uniform distribution
                const theta = Math.random() * 2 * Math.PI;
                
                const offsetX = r * Math.sin(theta);
                const offsetY = r * Math.cos(theta);

                const worldX = fieldCenterX + offsetX;
                const worldY = fieldCenterY + offsetY;

                contacts.push(createContact(
                    `T-${i + 1}`,
                    worldX,
                    worldY,
                    'TRAWLER',
                    'NEUTRAL',
                    Math.random() * 5, // Speed 0-5 kts
                    Math.random() * 360 // Random wandering heading
                ));
            }
            // 4 Bios (Stationary)
            for (let i = 0; i < 4; i++) {
                contacts.push(createContact(
                    `B-${i+1}`,
                    -15000 + Math.random() * 30000,
                    -5000 + Math.random() * 20000,
                    'BIOLOGIC', 
                    'NEUTRAL',
                    0,
                    Math.random() * 360
                ));
            }

            return {
                x: 0, y: 0, heading: 0, speed: 5, depth: 150,
                contacts,
                gameTime: 0
            };
        }
    },
    {
        id: 'sc2',
        title: "Duel in the Deep",
        description: "1v1 ASW. Hunter-Killer Logic. Kill or be Killed.",
        setup: (): Partial<SubmarineState> => {
            return {
                x: 0, y: 0, heading: 0, speed: 5, depth: 400,
                contacts: [
                    createContact('RED-1', 10000, 10000, 'SUB', 'ENEMY', 5, 180)
                ],
                gameTime: 0
            };
        }
    },
    {
        id: 'sc3',
        title: "Wolfpack",
        description: "ASuW vs SAG. 1 HVU + 2 Escorts. Escorts use Active Sonar.",
        setup: (): Partial<SubmarineState> => {
            const hvu = createContact('HVU', 15000, 15000, 'MERCHANT', 'ENEMY', 15, 270);
            const esc1 = createContact('ESC-1', 18000, 18000, 'ESCORT', 'ENEMY', 20, 270);
            const esc2 = createContact('ESC-2', 12000, 12000, 'ESCORT', 'ENEMY', 20, 270);

            // Escorts have high sensitivity and active sonar capability (implied by type)
            return {
                x: 0, y: 0, heading: 45, speed: 5, depth: 150,
                contacts: [hvu, esc1, esc2],
                gameTime: 0
            };
        }
    },
    {
        id: 'sc4',
        title: "Silent Stalk",
        description: "Tracking Exercise. Hold contact. Do not be detected.",
        setup: (): Partial<SubmarineState> => {
            const sub = createContact('GHOST', 8000, 8000, 'SUB', 'ENEMY', 4, 90);
            sub.sourceLevel = 0.5; // Quiet
            sub.sensitivity = 500000000; // High Alert

            return {
                x: 0, y: 0, heading: 0, speed: 3, depth: 600,
                contacts: [sub],
                gameTime: 0
            };
        }
    }
];
