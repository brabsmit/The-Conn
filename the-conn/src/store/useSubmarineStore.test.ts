import { describe, it, expect, beforeEach } from 'vitest';
import { useSubmarineStore } from './useSubmarineStore';

describe('useSubmarineStore', () => {
  beforeEach(() => {
    useSubmarineStore.setState({
      sonarTimeScale: 'FAST',
      trackers: [],
      sensorReadings: [],
      contacts: []
    });
  });

  it('should have default sonarTimeScale as FAST', () => {
    const state = useSubmarineStore.getState();
    expect(state.sonarTimeScale).toBe('FAST');
  });

  it('should update sonarTimeScale correctly', () => {
    const { setSonarTimeScale } = useSubmarineStore.getState();

    setSonarTimeScale('MED');
    expect(useSubmarineStore.getState().sonarTimeScale).toBe('MED');

    setSonarTimeScale('SLOW');
    expect(useSubmarineStore.getState().sonarTimeScale).toBe('SLOW');

    setSonarTimeScale('FAST');
    expect(useSubmarineStore.getState().sonarTimeScale).toBe('FAST');
  });
});
