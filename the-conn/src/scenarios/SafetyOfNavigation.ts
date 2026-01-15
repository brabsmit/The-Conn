import type { SubmarineState, Contact } from '../store/types';
import { getPolarPosition, getRandomRange } from '../utils/ScenarioUtils';
import { CONTACT_TYPES } from '../config/ContactDatabase';
import type { ContactTypeKey } from '../config/ContactDatabase';

// Helper to create basic contact
const createContact = (id: string, x: number, y: number, classification: any, type: 'ENEMY' | 'NEUTRAL', speed: number, heading: number): Contact => {
    const spec = CONTACT_TYPES[classification as ContactTypeKey] || CONTACT_TYPES.MERCHANT;

    // Task 151: Dynamic Variation (+/- 3dB)
    const variance = (Math.random() * 6) - 3; // Range [-3, +3]
    const sourceLevel = spec.acoustics.baseSL + variance;

    return {
        id,
        x,
        y,
        classification,
        type,
        speed,
        heading,
        depth: 50,
        sourceLevel: sourceLevel,
        baseSourceLevel: spec.acoustics.baseSL,
        acousticProfile: spec.acoustics.profile,
        transientRate: spec.acoustics.transientRate,
        wobbleState: 0,
        transientTimer: 0,
        cavitationSpeed: 10,
        status: 'ACTIVE',
        history: [],
        aiMode: type === 'ENEMY' ? 'PATROL' : undefined,
        aiDisabled: false,
        aiReactionTimer: undefined,
        canDetectTorpedoes: type === 'ENEMY'
    };
};

export const SafetyOfNavigation = {
    id: 'sc1',
    title: "Safety of Navigation",
    description: "Dense shipping lane (10k CPA). Trawlers and Biologics. Avoid collision. 30 Minutes survival.",
    setup: (): Partial<SubmarineState> => {
        const contacts: Contact[] = [];

        // --- 1. The Merchant Lane (10k CPA) ---
        // Lane Geometry:
        // Course: 225 deg (South-West)
        // CPA Offset: 10,000 yards to the "Right" (North-West side relative to Ownship? Or East?)
        // Let's place the lane such that it passes 10k yards from Ownship (0,0).
        // To have ships at Bearing 045 (NE) avoid collision while heading 225 (SW),
        // they must be offset from the diagonal.
        // CPA Point for Course 225 passing 10k from origin:
        // Normal to 225 is 135 or 315.
        // Let's offset to 135 (SE) or 315 (NW).
        // If we offset to 315 (NW), the lane is "above" ownship.
        // If we offset to 135 (SE), the lane is "below" ownship.
        // "Spawn Center = Polar(12,000yds, 045°)".
        // 045 is NE. If we offset 10k perpendicular to 225 from the 045 radial?
        // Let's just define the lane line explicitly.
        // Point on line: P_cpa = 10000 yds at Bearing 315 (-45). (x: -7071, y: 7071).
        // Lane Heading: 225.
        // Ships will be placed along this line relative to P_cpa.
        // Upstream (towards 045): "Closing".
        // Downstream (towards 225): "Opening".

        const laneHeading = 225;
        const radHeading = (laneHeading * Math.PI) / 180;
        const laneDirX = Math.sin(radHeading);
        const laneDirY = Math.cos(radHeading);

        // Normal vector (-cos, sin) ?
        // Let's use getPolarPosition.
        // CPA Point is 10k yds at Bearing 315 (NW).
        const cpaPoint = getPolarPosition({ x: 0, y: 0 }, 10000, 315);

        // M1 & M2: Closing (Upstream). Located "behind" the CPA point relative to motion.
        // i.e. at CPA Point - Distance * Direction.
        // Place them roughly 15k and 20k yards upstream (so they are at ~18k-23k range total? No)
        // If they are at CPA point, range is 10k.
        // If they are 10k upstream, range is sqrt(10k^2 + 10k^2) = 14k.
        // User said "Spawn Center = Polar(12k, 045)".
        // 12k range at 045 is roughly consistent with being upstream on this lane.

        const merchants = [
            { id: 'M-1', dist: -23000, speed: 12 }, // Closing (Range ~25k)
            { id: 'M-2', dist: -15000, speed: 15 }, // Closing (Range ~18k)
            { id: 'M-3', dist: 2000, speed: 10 },   // Opening (past CPA)
            { id: 'M-4', dist: 10000, speed: 14 }   // Opening
        ];

        merchants.forEach(m => {
            const posX = cpaPoint.x + (m.dist * laneDirX);
            const posY = cpaPoint.y + (m.dist * laneDirY);

            contacts.push(createContact(
                m.id,
                posX,
                posY,
                'MERCHANT',
                'NEUTRAL',
                m.speed,
                laneHeading
            ));
        });

        // --- 2. Trawler Zone (Port Beam) ---
        // Center: Polar(8000, 270)
        const trawlerCenter = getPolarPosition({ x: 0, y: 0 }, 8000, 270);

        for (let i = 0; i < 4; i++) {
            // Scatter within 1000 yds
            const r = Math.sqrt(Math.random()) * 1000;
            const theta = Math.random() * 360;
            const pos = getPolarPosition(trawlerCenter, r, theta);

            contacts.push(createContact(
                `T-${i+1}`,
                pos.x,
                pos.y,
                'TRAWLER',
                'NEUTRAL',
                getRandomRange(2, 5),
                Math.random() * 360 // Wandering
            ));
        }

        // --- 3. Biologics (Deep Field) ---
        // > 15,000 yds
        for (let i = 0; i < 3; i++) {
            const range = getRandomRange(15000, 25000);
            const bearing = Math.random() * 360;
            const pos = getPolarPosition({ x: 0, y: 0 }, range, bearing);

            contacts.push(createContact(
                `B-${i+1}`,
                pos.x,
                pos.y,
                'BIOLOGIC',
                'NEUTRAL',
                0,
                Math.random() * 360
            ));
        }

        return {
            x: 0, y: 0, heading: 0, speed: 5, depth: 150,
            contacts,
            gameTime: 0,
            scriptedEvents: []
        };
    }
};
