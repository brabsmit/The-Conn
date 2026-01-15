/**
 * ContactManager - Handles contact state management
 * - Signature dynamics (wobble, transients)
 * - Scenario-specific behaviors
 * - Contact updates from scenario director
 */

import type { Contact } from '../store/types';

// Signature Constants
const WOBBLE_STEP_PER_TICK = 0.1;
const MAX_WOBBLE = 2.0; // dB
const TRANSIENT_SPIKE = 10; // dB
const TRANSIENT_DURATION = 2.0; // seconds

// Scenario Constants
const SC3_SPRINT_DURATION = 240; // seconds
const SC3_CYCLE_DURATION = 600; // seconds
const SC3_SPRINT_SPEED = 25; // knots
const SC3_DRIFT_SPEED = 5; // knots

// ============================================================================
// SIGNATURE DYNAMICS
// ============================================================================

export interface SignatureDynamicsContext {
  delta: number;
}

export interface SignatureDynamicsResult {
  sourceLevel: number;
  wobbleState: number | undefined;
  transientTimer: number | undefined;
}

/**
 * Updates contact acoustic signature dynamics (wobble, transients)
 */
export function updateSignatureDynamics(
  contact: Contact,
  context: SignatureDynamicsContext
): SignatureDynamicsResult {
  const baseSL = contact.baseSourceLevel || 120;
  let effectiveSL = baseSL;
  let wobbleState = contact.wobbleState;
  let transientTimer = contact.transientTimer;

  // Dirty Profile (Wobble)
  if (contact.acousticProfile === 'DIRTY') {
    const wobbleStep = (Math.random() - 0.5) * WOBBLE_STEP_PER_TICK * context.delta;
    wobbleState = (wobbleState || 0) + wobbleStep;

    // Clamp
    wobbleState = Math.max(-MAX_WOBBLE, Math.min(MAX_WOBBLE, wobbleState));

    effectiveSL += wobbleState;
  }

  // Transient Logic
  if (transientTimer && transientTimer > 0) {
    effectiveSL += TRANSIENT_SPIKE;
    transientTimer -= (1 / 60) * context.delta;
  } else {
    // Chance to trigger new transient
    if (contact.transientRate) {
      const prob = (contact.transientRate / 60) * context.delta;
      if (Math.random() < prob) {
        transientTimer = TRANSIENT_DURATION;
        effectiveSL += TRANSIENT_SPIKE;
      }
    }
  }

  return {
    sourceLevel: effectiveSL,
    wobbleState,
    transientTimer,
  };
}

// ============================================================================
// SCENARIO-SPECIFIC BEHAVIORS
// ============================================================================

export interface ScenarioBehaviorContext {
  scenarioId: string | null;
  gameTime: number;
}

export interface ScenarioBehaviorResult {
  speed?: number;
}

/**
 * Applies scenario-specific behaviors to contacts
 */
export function applyScenarioBehavior(
  contact: Contact,
  context: ScenarioBehaviorContext
): ScenarioBehaviorResult {
  const result: ScenarioBehaviorResult = {};

  // Scenario 3: Sprint & Drift (Escorts)
  if (
    context.scenarioId === 'sc3' &&
    contact.classification === 'ESCORT' &&
    contact.type === 'ENEMY'
  ) {
    const cycleTime = context.gameTime % SC3_CYCLE_DURATION;
    if (cycleTime < SC3_SPRINT_DURATION) {
      result.speed = SC3_SPRINT_SPEED;
    } else {
      result.speed = SC3_DRIFT_SPEED;
    }
  }

  return result;
}

// ============================================================================
// DIRECTOR UPDATES
// ============================================================================

export interface DirectorUpdate {
  heading?: number;
  hasZigged?: boolean;
}

/**
 * Applies scenario director updates to contact
 */
export function applyDirectorUpdates(
  contact: Contact,
  directorUpdate: DirectorUpdate | undefined
): Partial<Contact> {
  if (!contact.aiDisabled && directorUpdate) {
    const result: Partial<Contact> = {};
    if (directorUpdate.heading !== undefined) {
      result.heading = directorUpdate.heading;
    }
    if (directorUpdate.hasZigged !== undefined) {
      result.hasZigged = directorUpdate.hasZigged;
    }
    return result;
  }
  return {};
}

// ============================================================================
// MANUAL SONAR OVERRIDES
// ============================================================================

export interface SonarOverrideResult {
  isActivePingEnabled?: boolean;
  activePingTimer?: number;
}

/**
 * Applies manual sonar state overrides
 */
export function applySonarOverrides(contact: Contact): SonarOverrideResult {
  const result: SonarOverrideResult = {};

  // Force Active State or Silence (Takes precedence over AI)
  if (contact.sonarState === 'ACTIVE') {
    result.isActivePingEnabled = true;
  } else if (contact.sonarState === 'SILENT') {
    result.isActivePingEnabled = false;
  }

  // Force One-Shot Ping
  if (contact.forceOneShotPing) {
    result.activePingTimer = 0;
    result.isActivePingEnabled = true;
  }

  return result;
}
