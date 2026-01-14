/**
 * Domain hook for weapons systems
 * Provides access to torpedo tubes and torpedoes in the water
 */

import { useSubmarineStore } from '../store/useSubmarineStore';
import type { Tube, Torpedo, WeaponData } from '../store/types';

export interface WeaponState {
  tubes: Tube[];
  torpedoes: Torpedo[];
}

export interface WeaponActions {
  loadTube: (tubeId: number, weaponData: WeaponData) => void;
  floodTube: (tubeId: number) => void;
  equalizeTube: (tubeId: number) => void;
  openTube: (tubeId: number) => void;
  fireTube: (tubeId: number, designatedTargetId?: string, enableRange?: number, gyroAngle?: number) => void;
}

/**
 * Hook to access weapon state
 * @returns Current tubes and torpedoes
 */
export const useWeaponState = (): WeaponState => {
  return useSubmarineStore((state) => ({
    tubes: state.tubes,
    torpedoes: state.torpedoes,
  }));
};

/**
 * Hook to access weapon actions
 * @returns Weapon control actions
 */
export const useWeaponActions = (): WeaponActions => {
  return useSubmarineStore((state) => ({
    loadTube: state.loadTube,
    floodTube: state.floodTube,
    equalizeTube: state.equalizeTube,
    openTube: state.openTube,
    fireTube: state.fireTube,
  }));
};

/**
 * Convenience hooks for specific weapon data
 */

export const useTubes = () => {
  return useSubmarineStore((state) => state.tubes);
};

export const useTorpedoes = () => {
  return useSubmarineStore((state) => state.torpedoes);
};

export const useTube = (tubeId: number) => {
  return useSubmarineStore((state) => state.tubes.find(t => t.id === tubeId));
};

/**
 * Hook to check if any tube is in a specific status
 */
export const useTubeStatus = () => {
  return useSubmarineStore((state) => {
    const readyToFire = state.tubes.filter(t => t.status === 'OPEN').length;
    const loading = state.tubes.filter(t => t.status === 'LOADING').length;
    const flooding = state.tubes.filter(t => t.status === 'FLOODING').length;
    const empty = state.tubes.filter(t => t.status === 'EMPTY').length;

    return { readyToFire, loading, flooding, empty };
  });
};

/**
 * Hook to get torpedoes in specific states
 */
export const useActiveTorpedoes = () => {
  return useSubmarineStore((state) =>
    state.torpedoes.filter(t => t.status === 'RUNNING')
  );
};

export const useHostileTorpedoes = () => {
  return useSubmarineStore((state) =>
    state.torpedoes.filter(t => t.isHostile && t.status === 'RUNNING')
  );
};
