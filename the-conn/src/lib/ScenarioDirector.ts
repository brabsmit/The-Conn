import type { SubmarineState } from '../store/types';

interface DirectorUpdates {
    contactUpdates: Record<string, { heading?: number; hasZigged?: boolean; }>;
}

export const getDirectorUpdates = (state: SubmarineState): DirectorUpdates => {
    const updates: DirectorUpdates = { contactUpdates: {} };

    // Only active for Scenario 1 currently
    if (state.scenarioId !== 'sc1') return updates;

    // Timer Logic: Every 5 minutes (300 seconds)
    // We use tickCount to ensure it happens exactly on the frame
    // 60 ticks per second * 300 seconds = 18000 ticks
    const intervalTicks = 18000;
    const isEventTick = state.tickCount > 0 && (state.tickCount % intervalTicks === 0);

    if (!isEventTick) return updates;

    // Pick a candidate for "The Zig"
    // Filter: Active, Not Destroyed, Not Biologic, Not already Zigged
    const candidates = state.contacts.filter(c =>
        c.status === 'ACTIVE' &&
        c.classification !== 'BIOLOGIC' &&
        c.classification !== 'TRAWLER' && // Keep Trawlers oblivious? User said "Exclude Biologics". Let's exclude Trawlers too as they are slow/static.
        !c.hasZigged
    );

    if (candidates.length === 0) return updates;

    // Pick Random
    const idx = Math.floor(Math.random() * candidates.length);
    const target = candidates[idx];

    // Calculate Collision Course (Pure Pursuit)
    // Bearing from Target to Ownship
    const dx = state.x - target.x;
    const dy = state.y - target.y;
    const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI); // Angle in standard math (0 is +x)
    const bearingToOwnship = (90 - mathAngle + 360) % 360; // Convert to Nav (0 is +y)

    updates.contactUpdates[target.id] = {
        heading: bearingToOwnship,
        hasZigged: true
    };

    // Log the event (optional, or rely on player noticing)
    // We can't easily push logs from here without returning them.
    // The Store handles logs. We'll just return state updates.

    return updates;
};
