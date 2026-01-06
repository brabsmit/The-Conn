import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from './useSubmarineStore';

describe('useSubmarineStore', () => {
  beforeEach(() => {
    useSubmarineStore.setState({
      timeScale: 'FAST',
      trackers: [],
      sensorReadings: [],
      contacts: []
    });
  });

  it('should have default timeScale as FAST', () => {
    const state = useSubmarineStore.getState();
    expect(state.timeScale).toBe('FAST');
  });

  it('should update timeScale correctly', () => {
    const { setTimeScale } = useSubmarineStore.getState();

    setTimeScale('MED');
    expect(useSubmarineStore.getState().timeScale).toBe('MED');

    setTimeScale('SLOW');
    expect(useSubmarineStore.getState().timeScale).toBe('SLOW');

    setTimeScale('FAST');
    expect(useSubmarineStore.getState().timeScale).toBe('FAST');
  });
});
