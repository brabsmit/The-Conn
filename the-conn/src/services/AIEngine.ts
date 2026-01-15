/**
 * AIEngine - Handles enemy AI behavior and threat assessment
 * - State machine (PATROL, APPROACH, PROSECUTE, ATTACK, EVADE)
 * - Threat perception (ownship and torpedo detection)
 * - Decision making and tactical behavior
 */

import { normalizeAngle, FEET_PER_KNOT_PER_TICK } from '../lib/math';
import type { Contact, Torpedo } from '../store/types';

// AI Constants
const AI_UPDATE_INTERVAL = 1.0; // seconds
const DETECTION_THRESHOLD = 0.5;
const APPROACH_LOST_CONTACT_THRESHOLD = -0.2;
const PROSECUTE_THRESHOLD = 0.4;
const PROSECUTE_LOST_CONTACT_THRESHOLD = -0.5;
const FIRE_LOCK_THRESHOLD = 0.9;
const FIRE_TRACKING_TIME = 30; // seconds
const TORPEDO_COOLDOWN_TICKS = 600; // ticks
const LEAD_INTERCEPT_TIME = 300; // seconds
const SILENT_SPEED = 5; // knots
const HUNT_SPEED = 15; // knots
const EVADE_SPEED = 25; // knots
const CLOSE_RANGE_THRESHOLD_YARDS = 2000;
const TORPEDO_PASSIVE_DETECTION_RANGE = 3000; // yards
const TORPEDO_PASSIVE_DETECTION_RANGE_BAFFLES = 1000; // yards
const TORPEDO_ACTIVE_DETECTION_RANGE = 4000; // yards
const REACTION_TIME_ACTIVE = 0; // seconds (immediate)
const REACTION_TIME_PASSIVE = 2; // seconds
const REACTION_TIME_BAFFLES = 10; // seconds

// ============================================================================
// AI CONTEXT
// ============================================================================

export interface AIContext {
  gameTime: number;
  ownship: {
    x: number;
    y: number;
    heading: number;
    speed: number;
    noiseLevel: number;
  };
  torpedoes: Torpedo[];
}

export interface AIDecision {
  heading?: number;
  speed?: number;
  aiMode?: Contact['aiMode'];
  isActivePingEnabled?: boolean;
  activePingTimer?: number;
  torpedoCooldown?: number;
  trackingTimer?: number;
  aiReactionTimer?: number;
  shouldFire?: boolean;
}

// ============================================================================
// MAIN AI UPDATE
// ============================================================================

/**
 * Updates enemy AI behavior based on current situation
 */
export function updateEnemyAI(contact: Contact, context: AIContext): AIDecision {
  // Skip if AI is disabled
  if (contact.aiDisabled) {
    return {};
  }

  // Skip if not an enemy
  if (contact.type !== 'ENEMY') {
    return {};
  }

  const timeSinceLastUpdate = context.gameTime - (contact.aiLastUpdate || 0);

  // Only run AI every AI_UPDATE_INTERVAL seconds
  if (timeSinceLastUpdate < AI_UPDATE_INTERVAL) {
    return {};
  }

  // Merchants don't react
  if (contact.classification === 'MERCHANT') {
    return {};
  }

  // Trawlers are oblivious (allow physics but skip AI)
  if (contact.classification === 'TRAWLER') {
    return {};
  }

  const decision: AIDecision = {};

  // Calculate detection of ownship
  const { signalExcess, distanceYards, angleToOwnship } = detectOwnship(contact, context);

  // Initialize AI mode if needed
  const currentMode = contact.aiMode || 'PATROL';

  // Update cooldown
  if (contact.torpedoCooldown && contact.torpedoCooldown > 0) {
    decision.torpedoCooldown = contact.torpedoCooldown - 1;
  }

  // State machine
  const stateMachineResult = runStateMachine(
    currentMode,
    signalExcess,
    distanceYards,
    angleToOwnship,
    contact,
    context,
    timeSinceLastUpdate
  );

  Object.assign(decision, stateMachineResult);

  // Threat perception (torpedoes)
  const threatResult = assessThreatFromTorpedoes(contact, context);
  if (threatResult.detectedThreatType !== 'NONE') {
    const reactionResult = handleThreatReaction(
      contact,
      threatResult,
      decision.aiMode || currentMode
    );
    Object.assign(decision, reactionResult);
  } else {
    // Reset reaction timer if no threat
    if (contact.aiMode !== 'EVADE') {
      decision.aiReactionTimer = undefined;
    }
  }

  return decision;
}

// ============================================================================
// DETECTION
// ============================================================================

interface DetectionResult {
  signalExcess: number;
  distanceYards: number;
  angleToOwnship: number;
}

/**
 * Detects ownship using passive sonar model
 */
function detectOwnship(contact: Contact, context: AIContext): DetectionResult {
  const dx = context.ownship.x - contact.x;
  const dy = context.ownship.y - contact.y;
  const distSquared = dx * dx + dy * dy;
  const distanceYards = Math.sqrt(distSquared) / 3;

  const sensitivity = contact.sensitivity !== undefined ? contact.sensitivity : 300000000;
  const signalStrength = (context.ownship.noiseLevel / Math.max(1, distSquared)) * sensitivity;
  const signalExcess = signalStrength - DETECTION_THRESHOLD;

  const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);

  return { signalExcess, distanceYards, angleToOwnship };
}

// ============================================================================
// STATE MACHINE
// ============================================================================

/**
 * Runs the AI state machine
 */
function runStateMachine(
  currentMode: Contact['aiMode'],
  signalExcess: number,
  distanceYards: number,
  angleToOwnship: number,
  contact: Contact,
  context: AIContext,
  timeSinceLastUpdate: number
): AIDecision {
  const decision: AIDecision = { aiMode: currentMode };

  switch (currentMode) {
    case 'PATROL':
    case 'IDLE':
      if (signalExcess > 0) {
        decision.aiMode = 'APPROACH';
      }
      break;

    case 'APPROACH':
      if (signalExcess < APPROACH_LOST_CONTACT_THRESHOLD) {
        decision.aiMode = 'PATROL';
      } else {
        // Intelligent maneuvering - lead intercept
        const interceptHeading = calculateLeadIntercept(
          contact,
          context.ownship
        );
        decision.heading = interceptHeading;
        decision.speed = SILENT_SPEED;

        // Transition to PROSECUTE if strong signal
        if (signalExcess > PROSECUTE_THRESHOLD) {
          decision.aiMode = 'PROSECUTE';
          decision.isActivePingEnabled = true;
          decision.activePingTimer = 0;
        }

        // Close range attack
        if (distanceYards < CLOSE_RANGE_THRESHOLD_YARDS) {
          if (!contact.torpedoCooldown || contact.torpedoCooldown <= 0) {
            decision.aiMode = 'ATTACK';
          }
        }
      }
      break;

    case 'PROSECUTE':
      // Turn towards contact
      const bearingToOwnship = normalizeAngle(90 - angleToOwnship);
      decision.heading = bearingToOwnship;
      decision.speed = HUNT_SPEED;

      // Ensure active sonar is enabled
      if (!contact.isActivePingEnabled) {
        decision.isActivePingEnabled = true;
      }

      // Weapon ROE (tracking timer)
      if (signalExcess > FIRE_LOCK_THRESHOLD) {
        const currentTrackingTimer = contact.trackingTimer || 0;
        decision.trackingTimer = currentTrackingTimer + timeSinceLastUpdate;

        if (decision.trackingTimer > FIRE_TRACKING_TIME) {
          if (!contact.torpedoCooldown || contact.torpedoCooldown <= 0) {
            decision.aiMode = 'ATTACK';
            decision.trackingTimer = 0;
          }
        }
      } else {
        decision.trackingTimer = 0;
      }

      // Lost contact
      if (signalExcess < PROSECUTE_LOST_CONTACT_THRESHOLD) {
        decision.aiMode = 'PATROL';
        decision.isActivePingEnabled = false;
        decision.trackingTimer = 0;
      }
      break;

    case 'ATTACK':
      if (!contact.torpedoCooldown || contact.torpedoCooldown <= 0) {
        decision.torpedoCooldown = TORPEDO_COOLDOWN_TICKS;
        decision.aiMode = 'EVADE';
        decision.shouldFire = true;
      }
      break;

    case 'EVADE':
      decision.speed = EVADE_SPEED;
      const evadeBearing = normalizeAngle(90 - angleToOwnship);
      decision.heading = normalizeAngle(evadeBearing + 180); // Run away
      break;
  }

  return decision;
}

/**
 * Calculates lead intercept heading
 */
function calculateLeadIntercept(
  contact: Contact,
  ownship: { x: number; y: number; heading: number; speed: number }
): number {
  // Predict ownship position in LEAD_INTERCEPT_TIME seconds
  const predictedOx =
    ownship.x +
    Math.sin((ownship.heading * Math.PI) / 180) *
      ownship.speed *
      FEET_PER_KNOT_PER_TICK *
      60 *
      (LEAD_INTERCEPT_TIME / 60);
  const predictedOy =
    ownship.y +
    Math.cos((ownship.heading * Math.PI) / 180) *
      ownship.speed *
      FEET_PER_KNOT_PER_TICK *
      60 *
      (LEAD_INTERCEPT_TIME / 60);

  const pdx = predictedOx - contact.x;
  const pdy = predictedOy - contact.y;
  const pAngle = Math.atan2(pdy, pdx) * (180 / Math.PI);
  return normalizeAngle(90 - pAngle);
}

// ============================================================================
// THREAT ASSESSMENT
// ============================================================================

interface ThreatAssessment {
  detectedThreatType: 'NONE' | 'PASSIVE' | 'ACTIVE';
  detectedInBaffles: boolean;
}

/**
 * Assesses threat from torpedoes
 */
function assessThreatFromTorpedoes(contact: Contact, context: AIContext): ThreatAssessment {
  let detectedThreatType: 'NONE' | 'PASSIVE' | 'ACTIVE' = 'NONE';
  let detectedInBaffles = false;

  const canDetect =
    contact.canDetectTorpedoes !== undefined ? contact.canDetectTorpedoes : true;

  if (!canDetect) {
    return { detectedThreatType: 'NONE', detectedInBaffles: false };
  }

  for (const torpedo of context.torpedoes) {
    if (torpedo.status !== 'RUNNING') continue;

    const tDx = torpedo.position.x - contact.x;
    const tDy = torpedo.position.y - contact.y;
    const distToTorp = Math.sqrt(tDx * tDx + tDy * tDy) / 3; // yards

    // Calculate bearing info
    const angleToTorp = Math.atan2(tDy, tDx) * (180 / Math.PI);
    const bearingToTorp = normalizeAngle(90 - angleToTorp);
    let relBrg = Math.abs((contact.heading || 0) - bearingToTorp);
    if (relBrg > 180) relBrg = 360 - relBrg;
    const inBaffles = relBrg > 150;

    // Active intercept (ping)
    const isPinging =
      torpedo.distanceTraveled >= torpedo.enableRange && torpedo.searchMode === 'ACTIVE';
    if (isPinging && distToTorp < TORPEDO_ACTIVE_DETECTION_RANGE) {
      detectedThreatType = 'ACTIVE';
      detectedInBaffles = inBaffles;
      break; // Priority
    }

    // Passive detection
    const detectionRange = inBaffles
      ? TORPEDO_PASSIVE_DETECTION_RANGE_BAFFLES
      : TORPEDO_PASSIVE_DETECTION_RANGE;
    if (distToTorp < detectionRange) {
      detectedThreatType = 'PASSIVE';
      detectedInBaffles = inBaffles;
      // Don't break, check for active
    }
  }

  return { detectedThreatType, detectedInBaffles };
}

/**
 * Handles reaction to detected threat
 */
function handleThreatReaction(
  contact: Contact,
  threat: ThreatAssessment,
  currentMode: Contact['aiMode']
): AIDecision {
  const decision: AIDecision = {};

  if (currentMode !== 'EVADE') {
    if (contact.aiReactionTimer === undefined) {
      if (threat.detectedThreatType === 'ACTIVE') {
        decision.aiReactionTimer = REACTION_TIME_ACTIVE;
      } else {
        decision.aiReactionTimer = threat.detectedInBaffles
          ? REACTION_TIME_BAFFLES
          : REACTION_TIME_PASSIVE;
      }
    } else {
      const newTimer = contact.aiReactionTimer - 1;
      if (newTimer <= 0) {
        decision.aiMode = 'EVADE';
        decision.aiReactionTimer = undefined;
      } else {
        decision.aiReactionTimer = newTimer;
      }
    }
  }

  return decision;
}
