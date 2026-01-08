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
            // 3-5 Merchants in a lane (Course 090 +/- 10)
            for (let i = 0; i < 4; i++) {
                contacts.push(createContact(
                    `M-${i+1}`,
                    -10000 + Math.random() * 20000,
                    10000 + Math.random() * 5000,
                    'MERCHANT',
                    'NEUTRAL',
                    10 + Math.random() * 5,
                    90 + (Math.random() - 0.5) * 20
                ));
            }
            // 10 Trawlers (Stationary/Slow)
            for (let i = 0; i < 10; i++) {
                contacts.push(createContact(
                    `T-${i+1}`,
                    -15000 + Math.random() * 30000,
                    -5000 + Math.random() * 20000,
                    'BIOLOGICAL', // Re-using BIO for small craft/noise
                    'NEUTRAL',
                    Math.random() * 3,
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
