/**
 * Simulation Phase Functions
 *
 * This module exports all simulation phase functions that are called during the game tick.
 * Breaking down the monolithic tick() function into these phases improves:
 * - Testability: Each phase can be unit tested independently
 * - Maintainability: Clear separation of concerns
 * - Readability: Each phase has a clear purpose and interface
 * - Performance: Easier to profile and optimize individual phases
 */

export * from './updateOwnshipPhysics';

// Future exports (to be implemented):
// export * from './updateContactAI';
// export * from './processSensors';
// export * from './updateWeapons';
// export * from './checkVictoryConditions';
