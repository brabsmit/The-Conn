/**
 * Domain hook for scenario and game state management
 * Provides access to game state, scenarios, and simulation controls
 */

import { useSubmarineStore } from '../store/useSubmarineStore';
import type { GameMetrics, ViewScale, Station, ScriptedEvent, SubmarineState } from '../store/types';

export interface ScenarioState {
  appState: 'MENU' | 'GAME';
  expertMode: boolean;
  godMode: boolean;
  scenarioId: string | null;
  gameState: 'RUNNING' | 'VICTORY' | 'DEFEAT';
  gameTime: number;
  tickCount: number;
  metrics: GameMetrics;
  viewScale: ViewScale;
  activeStation: Station;
  scriptedEvents: ScriptedEvent[];
  lastScenarioTick?: number;
}

export interface ScenarioActions {
  setAppState: (state: 'MENU' | 'GAME') => void;
  setExpertMode: (enabled: boolean) => void;
  toggleGodMode: () => void;
  setViewScale: (scale: ViewScale) => void;
  setActiveStation: (station: Station) => void;
  loadScenario: (state: Partial<SubmarineState>, id?: string) => void;
  resetSimulation: () => void;
  tick: (delta?: number) => void;
}

/**
 * Hook to access scenario state
 * @returns Current game and scenario state
 */
export const useScenarioState = (): ScenarioState => {
  return useSubmarineStore((state) => ({
    appState: state.appState,
    expertMode: state.expertMode,
    godMode: state.godMode,
    scenarioId: state.scenarioId,
    gameState: state.gameState,
    gameTime: state.gameTime,
    tickCount: state.tickCount,
    metrics: state.metrics,
    viewScale: state.viewScale,
    activeStation: state.activeStation,
    scriptedEvents: state.scriptedEvents,
    lastScenarioTick: state.lastScenarioTick,
  }));
};

/**
 * Hook to access scenario actions
 * @returns Game and scenario management actions
 */
export const useScenarioActions = (): ScenarioActions => {
  return useSubmarineStore((state) => ({
    setAppState: state.setAppState,
    setExpertMode: state.setExpertMode,
    toggleGodMode: state.toggleGodMode,
    setViewScale: state.setViewScale,
    setActiveStation: state.setActiveStation,
    loadScenario: state.loadScenario,
    resetSimulation: state.resetSimulation,
    tick: state.tick,
  }));
};

/**
 * Convenience hooks for specific scenario data
 */

export const useAppState = () => {
  return useSubmarineStore((state) => state.appState);
};

export const useExpertMode = () => {
  return useSubmarineStore((state) => state.expertMode);
};

export const useGodMode = () => {
  return useSubmarineStore((state) => state.godMode);
};

export const useScenarioId = () => {
  return useSubmarineStore((state) => state.scenarioId);
};

export const useGameState = () => {
  return useSubmarineStore((state) => state.gameState);
};

export const useGameTime = () => {
  return useSubmarineStore((state) => state.gameTime);
};

export const useTickCount = () => {
  return useSubmarineStore((state) => state.tickCount);
};

export const useMetrics = () => {
  return useSubmarineStore((state) => state.metrics);
};

export const useViewScale = () => {
  return useSubmarineStore((state) => state.viewScale);
};

export const useActiveStation = () => {
  return useSubmarineStore((state) => state.activeStation);
};

export const useScriptedEvents = () => {
  return useSubmarineStore((state) => state.scriptedEvents);
};

/**
 * Hook to check if game is in progress
 */
export const useIsGameInProgress = () => {
  return useSubmarineStore((state) =>
    state.appState === 'GAME' && state.gameState === 'RUNNING'
  );
};

/**
 * Hook to check if game is over
 */
export const useIsGameOver = () => {
  return useSubmarineStore((state) =>
    state.gameState === 'VICTORY' || state.gameState === 'DEFEAT'
  );
};

/**
 * Hook to get victory status
 */
export const useVictoryStatus = () => {
  return useSubmarineStore((state) => {
    if (state.gameState === 'VICTORY') return 'victory';
    if (state.gameState === 'DEFEAT') return 'defeat';
    return 'ongoing';
  });
};
