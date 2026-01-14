/**
 * Domain hook for ownship navigation and status
 * Provides access to ownship state and navigation controls
 */

import { useSubmarineStore } from '../store/useSubmarineStore';

export interface OwnshipState {
  heading: number;
  speed: number;
  depth: number;
  x: number;
  y: number;
  orderedHeading: number;
  orderedSpeed: number;
  orderedDepth: number;
  fuel: number;
  battery: number;
  ownshipNoiseLevel: number;
  cavitating: boolean;
  ownShipHistory: Array<{ time: number; x: number; y: number; heading: number }>;
}

export interface OwnshipActions {
  setOrderedHeading: (heading: number) => void;
  setOrderedSpeed: (speed: number) => void;
  setOrderedDepth: (depth: number) => void;
}

/**
 * Hook to access ownship state
 * @returns Current ownship state
 */
export const useOwnshipState = (): OwnshipState => {
  return useSubmarineStore((state) => ({
    heading: state.heading,
    speed: state.speed,
    depth: state.depth,
    x: state.x,
    y: state.y,
    orderedHeading: state.orderedHeading,
    orderedSpeed: state.orderedSpeed,
    orderedDepth: state.orderedDepth,
    fuel: state.fuel,
    battery: state.battery,
    ownshipNoiseLevel: state.ownshipNoiseLevel,
    cavitating: state.cavitating,
    ownShipHistory: state.ownShipHistory,
  }));
};

/**
 * Hook to access ownship navigation actions
 * @returns Ownship control actions
 */
export const useOwnshipActions = (): OwnshipActions => {
  return useSubmarineStore((state) => ({
    setOrderedHeading: state.setOrderedHeading,
    setOrderedSpeed: state.setOrderedSpeed,
    setOrderedDepth: state.setOrderedDepth,
  }));
};

/**
 * Convenience hook to access specific ownship state properties
 * Useful when you only need a subset of the state
 */
export const useOwnshipPosition = () => {
  return useSubmarineStore((state) => ({
    x: state.x,
    y: state.y,
    heading: state.heading,
  }));
};

export const useOwnshipSpeed = () => {
  return useSubmarineStore((state) => state.speed);
};

export const useOwnshipDepth = () => {
  return useSubmarineStore((state) => state.depth);
};

export const useOwnshipOrders = () => {
  return useSubmarineStore((state) => ({
    orderedHeading: state.orderedHeading,
    orderedSpeed: state.orderedSpeed,
    orderedDepth: state.orderedDepth,
  }));
};

export const useOwnshipHistory = () => {
  return useSubmarineStore((state) => state.ownShipHistory);
};
