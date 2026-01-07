import { describe, it, expect, vi } from 'vitest';
import { useSubmarineStore } from './useSubmarineStore';

describe('useSubmarineStore Auto-Sequence', () => {
  it('should automatically transition tube status from DRY to OPEN when autoSequence is true', () => {
    // Setup
    const store = useSubmarineStore.getState();
    const tubeId = 1;

    // Initial State: EMPTY. Load it first manually to get to DRY or start from DRY?
    // Let's modify the state directly to start at DRY and autoSequence true.
    useSubmarineStore.setState(state => ({
      tubes: state.tubes.map(t =>
        t.id === tubeId
        ? { ...t, status: 'DRY', autoSequence: true, weaponData: { runDepth: 50, floor: 1000, ceiling: 50, searchMode: 'PASSIVE' } }
        : t
      )
    }));

    // Verify initial state
    let tube = useSubmarineStore.getState().tubes.find(t => t.id === tubeId);
    expect(tube?.status).toBe('DRY');
    expect(tube?.autoSequence).toBe(true);

    // 1. Tick should trigger Flood (DRY -> FLOODING)
    useSubmarineStore.getState().tick();
    tube = useSubmarineStore.getState().tubes.find(t => t.id === tubeId);
    expect(tube?.status).toBe('FLOODING');

    // 2. Advance ticks to complete Flooding (100 ticks)
    for(let i=0; i<110; i++) {
        useSubmarineStore.getState().tick();
    }

    // Should now be WET -> then Auto trigger Equalize -> EQUALIZING
    // Note: My logic in tick does: Progress update first, then Auto trigger.
    // So if progress finishes (Flooding -> Wet), the next block in same tick sees WET and triggers Equalize (Wet -> Equalizing).
    // So transition from Flooding to Equalizing might happen in one tick or next.
    // Let's check status.
    tube = useSubmarineStore.getState().tubes.find(t => t.id === tubeId);
    // It should ideally be EQUALIZING now because WET is transient in this auto sequence.
    expect(['WET', 'EQUALIZING']).toContain(tube?.status);

    // 3. Advance ticks to complete Equalizing (100 ticks)
    for(let i=0; i<110; i++) {
        useSubmarineStore.getState().tick();
    }

    // Should now be EQUALIZED -> Auto trigger Open -> OPENING
    tube = useSubmarineStore.getState().tubes.find(t => t.id === tubeId);
    expect(['EQUALIZED', 'OPENING']).toContain(tube?.status);

    // 4. Advance ticks to complete Opening (100 ticks)
    for(let i=0; i<110; i++) {
        useSubmarineStore.getState().tick();
    }

    // Should now be OPEN
    tube = useSubmarineStore.getState().tubes.find(t => t.id === tubeId);
    expect(tube?.status).toBe('OPEN');

    // Check autoSequence is off
    // It turns off in the tick *after* it becomes OPEN.
    useSubmarineStore.getState().tick();
    tube = useSubmarineStore.getState().tubes.find(t => t.id === tubeId);
    expect(tube?.autoSequence).toBe(false);

    // Check Log
    const logs = useSubmarineStore.getState().logs;
    expect(logs.some(l => l.message.includes(`Tube #${tubeId} is ready`))).toBe(true);
  });
});
