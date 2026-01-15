import type { SubmarineState, Contact } from '../store/types'; // Alias for ease
import { getPolarPosition } from '../utils/ScenarioUtils'; // Assuming these exist or we create them
import { calculateSolutionCPA, normalizeAngle } from './tma';

// Extend DirectorUpdates to include adds/removes
export interface DirectorUpdates {
    contactUpdates: Record<string, { heading?: number; hasZigged?: boolean; }>;
    newContacts: Contact[];
    removedContactIds: string[];
}

const SPAWN_INTERVAL = 300; // 5 seconds (60 ticks * 5)
const TARGET_COUNT = 4;
const SPAWN_RANGE = 25000;
const DESPAWN_RANGE = 30000;
const CRITICAL_CPA = 1500;
const THREAT_HORIZON = 600; // 10 minutes

export const getDirectorUpdates = (state: SubmarineState): DirectorUpdates => {
    const updates: DirectorUpdates = {
        contactUpdates: {},
        newContacts: [],
        removedContactIds: []
    };

    if (state.scenarioId !== 'sc1') return updates;

    // Throttle: Run logic every 5 seconds
    if (state.tickCount % SPAWN_INTERVAL !== 0) return updates;

    // --- 1. STATE ANALYSIS ---
    const activeContacts = state.contacts.filter(c => c.status === 'ACTIVE');
    const trafficDensity = activeContacts.length;

    // Calculate Threats (CPA < 3000 in 10 mins)
    let criticalContacts = 0;
    let threats = activeContacts.map(c => {
        const mockSolution = {
            legs: [],
            speed: c.speed || 0,
            course: c.heading || 0,
            range: 0,
            bearing: 0,
            anchorTime: state.gameTime,
            anchorOwnShip: { x: state.x, y: state.y, heading: state.heading },
            computedWorldX: c.x,
            computedWorldY: c.y
        };

        const cpa = calculateSolutionCPA(mockSolution, {
            x: state.x, y: state.y, heading: state.heading, speed: state.speed
        }, state.gameTime);

        const isThreat = cpa.range < 3000 && cpa.time < THREAT_HORIZON;
        const isCritical = cpa.range < CRITICAL_CPA && cpa.time < THREAT_HORIZON;

        if (isCritical) criticalContacts++;

        return { id: c.id, cpa, isThreat, isCritical, contact: c };
    });

    // Bearing Diversity
    const quadrants = [0, 0, 0, 0]; // NE, SE, SW, NW
    activeContacts.forEach(c => {
        const dx = c.x - state.x;
        const dy = c.y - state.y;
        const bearing = normalizeAngle(90 - Math.atan2(dy, dx) * (180 / Math.PI));
        const qIndex = Math.floor(bearing / 90) % 4;
        quadrants[qIndex]++;
    });

    // --- 2. POPULATION CONTROL ---

    // A. Despawn Logic
    activeContacts.forEach(c => {
        const dx = c.x - state.x;
        const dy = c.y - state.y;
        const dist = Math.sqrt(dx*dx + dy*dy) / 3; // Yards

        if (dist > DESPAWN_RANGE) {
            // Check if opening
            const tSpeed = (c.speed || 0) * 1.68;
            const tHead = (c.heading || 0) * Math.PI / 180;
            const oSpeed = state.speed * 1.68;
            const oHead = state.heading * Math.PI / 180;

            const rvx = (tSpeed * Math.sin(tHead)) - (oSpeed * Math.sin(oHead));
            const rvy = (tSpeed * Math.cos(tHead)) - (oSpeed * Math.cos(oHead));

            const dot = dx * rvx + dy * rvy;

            // Dot product > 0 means relative velocity is in same direction as relative position -> Distance increasing (Opening)
            // Dot product < 0 means Distance decreasing (Closing)
            if (dot > 0) {
                updates.removedContactIds.push(c.id);
            }
        }
    });

    // B. Spawn Logic
    if (trafficDensity < TARGET_COUNT && criticalContacts === 0) {
        // Find Quiet Quadrant
        let bestQuad = 0;
        let minCount = Infinity;
        for (let i = 0; i < 4; i++) {
            if (quadrants[i] < minCount) {
                minCount = quadrants[i];
                bestQuad = i;
            }
        }
        const baseBearing = bestQuad * 90;
        const spawnBearing = normalizeAngle(baseBearing + Math.random() * 90);

        // Position
        const origin = { x: state.x, y: state.y };
        const spawnPos = getPolarPosition(origin, SPAWN_RANGE * 3, spawnBearing); // range in feet

        // Course Intercept Logic
        const leadMins = 15;
        const leadDist = state.speed * 1.68 * 60 * leadMins;
        const leadX = state.x + leadDist * Math.sin(state.heading * Math.PI / 180);
        const leadY = state.y + leadDist * Math.cos(state.heading * Math.PI / 180);

        const fuzz = 5000 * 3;
        const targetX = leadX + (Math.random() - 0.5) * fuzz;
        const targetY = leadY + (Math.random() - 0.5) * fuzz;

        const cDx = targetX - spawnPos.x;
        const cDy = targetY - spawnPos.y;
        const interceptHeading = normalizeAngle(90 - Math.atan2(cDy, cDx) * (180 / Math.PI));

        const newId = `C-${Date.now()}`;
        const newContact: Contact = {
            id: newId,
            x: spawnPos.x,
            y: spawnPos.y,
            heading: interceptHeading,
            speed: 10 + Math.random() * 10,
            depth: 0,
            type: 'NEUTRAL',
            classification: 'MERCHANT',
            status: 'ACTIVE',
            baseSourceLevel: 130,
            acousticProfile: 'CLEAN',
            history: []
        };

        updates.newContacts.push(newContact);
    }

    // --- 3. THREAT THROTTLING ---
    if (criticalContacts > 1) {
        const critList = threats.filter(t => t.isCritical).sort((a, b) => a.cpa.range - b.cpa.range);

        for (let i = 1; i < critList.length; i++) {
            const threat = critList[i];
            const dx = state.x - threat.contact.x;
            const dy = state.y - threat.contact.y;
            const bearingToOwn = normalizeAngle(90 - Math.atan2(dy, dx) * (180 / Math.PI));
            const newHeading = normalizeAngle(bearingToOwn + 135); // Turn away

            updates.contactUpdates[threat.id] = {
                heading: newHeading
            };
        }
    }

    // Random maneuver logic
    const boredContacts = threats.filter(t => !t.isThreat && !t.isCritical && t.contact.classification !== 'TRAWLER');
    if (boredContacts.length > 0) {
         // Chance 1/60 (once per 5 mins approx)
         if (Math.random() < (1/60)) {
             const victim = boredContacts[Math.floor(Math.random() * boredContacts.length)];
             const change = (Math.random() - 0.5) * 60; // +/- 30 deg
             const newH = normalizeAngle((victim.contact.heading || 0) + change);
             updates.contactUpdates[victim.id] = {
                 heading: newH,
                 hasZigged: true
             };
         }
    }

    return updates;
};
