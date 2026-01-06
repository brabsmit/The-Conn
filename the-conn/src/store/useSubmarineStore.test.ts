import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from './useSubmarineStore';

describe('useSubmarineStore', () => {
  beforeEach(() => {
    useSubmarineStore.setState({
      viewScale: 'FAST',
      trackers: [],
      sensorReadings: [],
      contacts: []
    });
  });

  it('should have default viewScale as FAST', () => {
    const state = useSubmarineStore.getState();
    expect(state.viewScale).toBe('FAST');
  });

  it('should update viewScale correctly', () => {
    const { setViewScale } = useSubmarineStore.getState();

    setViewScale('MED');
    expect(useSubmarineStore.getState().viewScale).toBe('MED');

    setViewScale('SLOW');
    expect(useSubmarineStore.getState().viewScale).toBe('SLOW');

    setViewScale('FAST');
    expect(useSubmarineStore.getState().viewScale).toBe('FAST');
  });
});
