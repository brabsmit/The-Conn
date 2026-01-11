import { describe, it, expect, vi } from 'vitest';
import { getDirectorUpdates } from './ScenarioDirector';
import type { SubmarineState } from '../store/types';

// Mock getPolarPosition and calculateSolutionCPA if needed,
// but since we are importing from actual files, we can use them if they are pure functions.
// However, `calculateSolutionCPA` logic might be complex.
// Let's assume integration test style for these utility functions.

const createMockState = (overrides: Partial<SubmarineState> = {}): SubmarineState => ({
    scenarioId: 'sc1',
    tickCount: 300, // Trigger interval
    gameTime: 0,
    x: 0,
    y: 0,
    heading: 0,
    speed: 10,
    contacts: [],
    // ... minimal other required fields
    appState: 'GAME',
    expertMode: false,
    godMode: false,
    metrics: {} as any,
    gameState: 'RUNNING',
    depth: 100,
    fuel: 100,
    battery: 100,
    ownShipHistory: [],
    ownshipNoiseLevel: 0,
    cavitating: false,
    transients: [],
    visualTransients: [],
    scriptedEvents: [],
    sensorReadings: [],
    logs: [],
    alertLevel: 'NORMAL',
    incomingTorpedoDetected: false,
    trackers: [],
    selectedTrackerId: null,
    tubes: [],
    torpedoes: [],
    viewScale: 'FAST',
    activeStation: 'TMA',
    orderedHeading: 0,
    orderedSpeed: 0,
    orderedDepth: 0,
    ...overrides
});

describe('ScenarioDirector', () => {
    it('should do nothing if scenarioId is not sc1', () => {
        const state = createMockState({ scenarioId: 'sc2' });
        const updates = getDirectorUpdates(state);
        expect(updates.newContacts).toHaveLength(0);
        expect(updates.removedContactIds).toHaveLength(0);
    });

    it('should do nothing if tickCount is not interval', () => {
        const state = createMockState({ tickCount: 299 });
        const updates = getDirectorUpdates(state);
        expect(updates.newContacts).toHaveLength(0);
    });

    it('should spawn contact if density is low', () => {
        const state = createMockState({
            contacts: [], // Empty
            tickCount: 300
        });
        const updates = getDirectorUpdates(state);
        expect(updates.newContacts).toHaveLength(1);
        const newContact = updates.newContacts[0];
        expect(newContact.classification).toBe('MERCHANT');
        expect(newContact.status).toBe('ACTIVE');
    });

    it('should despawn distant contact', () => {
        const distantContact = {
            id: 'c1',
            x: 0,
            y: 40000 * 3, // Way North
            heading: 0, // Heading North (Away)
            speed: 15, // Faster than ownship (10), so opening
            status: 'ACTIVE',
            classification: 'MERCHANT'
        } as any;

        const state = createMockState({
            contacts: [distantContact],
            tickCount: 300
        });

        const updates = getDirectorUpdates(state);
        expect(updates.removedContactIds).toContain('c1');
    });

    it('should not spawn if traffic is full (4)', () => {
        const contacts = Array.from({ length: 4 }, (_, i) => ({
            id: `c${i}`,
            x: 10000,
            y: 10000,
            status: 'ACTIVE',
            classification: 'MERCHANT'
        })) as any[];

        const state = createMockState({
            contacts: contacts,
            tickCount: 300
        });

        const updates = getDirectorUpdates(state);
        expect(updates.newContacts).toHaveLength(0);
    });

    it('should intervene (throttle) if two critical contacts exist', () => {
        // Create 2 critical contacts (Close and approaching)
        // Ownship at 0,0 heading 0.
        // C1 at 0, 2000 (North), heading 180 (South) -> Collision
        // C2 at 2000, 0 (East), heading 270 (West) -> Collision

        const c1 = {
            id: 'c1', x: 0, y: 2000 * 3, heading: 180, speed: 10, status: 'ACTIVE', classification: 'MERCHANT'
        } as any;
        const c2 = {
            id: 'c2', x: 2000 * 3, y: 0, heading: 270, speed: 10, status: 'ACTIVE', classification: 'MERCHANT'
        } as any;

        const state = createMockState({
            contacts: [c1, c2],
            tickCount: 300
        });

        const updates = getDirectorUpdates(state);

        // Should have updates for one of them
        const updateKeys = Object.keys(updates.contactUpdates);
        expect(updateKeys.length).toBeGreaterThan(0);
        // Expect heading change
        const updatedId = updateKeys[0];
        expect(updates.contactUpdates[updatedId].heading).toBeDefined();
    });
});
