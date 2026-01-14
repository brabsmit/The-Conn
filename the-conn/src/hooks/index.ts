/**
 * Domain hooks for The-Conn
 *
 * These hooks provide domain-specific facades over the central Zustand store,
 * reducing coupling and making it easier to reason about state access patterns.
 *
 * Usage:
 *   import { useOwnshipState, useOwnshipActions } from '@/hooks';
 */

// Ownship domain
export * from './useOwnship';

// Sensors domain
export * from './useSensors';

// Weapons domain
export * from './useWeapons';

// Trackers domain (TMA)
export * from './useTrackers';

// Contacts domain
export * from './useContacts';

// Scenario domain
export * from './useScenario';

// Utility hooks (existing)
export { useInterval } from './useInterval';
export { useResize } from './useResize';
export { useSonarAudio } from './useSonarAudio';
