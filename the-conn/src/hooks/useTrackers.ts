/**
 * Domain hook for TMA (Target Motion Analysis) trackers
 * Provides access to tracker state and TMA operations
 */

import { useSubmarineStore } from '../store/useSubmarineStore';
import type { Tracker, TrackerSolution } from '../store/types';

export interface TrackerState {
  trackers: Tracker[];
  selectedTrackerId: string | null;
}

export interface TrackerActions {
  designateTracker: (bearing: number) => void;
  setSelectedTracker: (id: string | null) => void;
  deleteTracker: (id: string) => void;
  updateTrackerSolution: (trackerId: string, solution: Partial<TrackerSolution>) => void;
  addSolutionLeg: (trackerId: string) => void;
}

/**
 * Hook to access tracker state
 * @returns Current trackers and selected tracker
 */
export const useTrackerState = (): TrackerState => {
  return useSubmarineStore((state) => ({
    trackers: state.trackers,
    selectedTrackerId: state.selectedTrackerId,
  }));
};

/**
 * Hook to access tracker actions
 * @returns TMA tracker management actions
 */
export const useTrackerActions = (): TrackerActions => {
  return useSubmarineStore((state) => ({
    designateTracker: state.designateTracker,
    setSelectedTracker: state.setSelectedTracker,
    deleteTracker: state.deleteTracker,
    updateTrackerSolution: state.updateTrackerSolution,
    addSolutionLeg: state.addSolutionLeg,
  }));
};

/**
 * Convenience hooks for specific tracker data
 */

export const useTrackers = () => {
  return useSubmarineStore((state) => state.trackers);
};

export const useSelectedTrackerId = () => {
  return useSubmarineStore((state) => state.selectedTrackerId);
};

export const useSelectedTracker = () => {
  return useSubmarineStore((state) => {
    if (!state.selectedTrackerId) return null;
    return state.trackers.find(t => t.id === state.selectedTrackerId) || null;
  });
};

export const useTracker = (trackerId: string) => {
  return useSubmarineStore((state) =>
    state.trackers.find(t => t.id === trackerId)
  );
};

/**
 * Hook to get trackers by type
 */
export const useSensorTrackers = () => {
  return useSubmarineStore((state) =>
    state.trackers.filter(t => t.kind === 'SENSOR' || !t.kind)
  );
};

export const useWeaponTrackers = () => {
  return useSubmarineStore((state) =>
    state.trackers.filter(t => t.kind === 'WEAPON')
  );
};

/**
 * Hook to get classified trackers
 */
export const useClassifiedTrackers = () => {
  return useSubmarineStore((state) =>
    state.trackers.filter(t => t.classificationStatus === 'CLASSIFIED')
  );
};

/**
 * Hook to get trackers with solutions
 */
export const useTrackersWithSolutions = () => {
  return useSubmarineStore((state) =>
    state.trackers.filter(t => t.solution && t.solution.legs && t.solution.legs.length > 0)
  );
};
