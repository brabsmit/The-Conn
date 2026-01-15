/**
 * SensorEngine - Handles all sensor and detection systems
 * - Passive sonar (bearing detection)
 * - Active sonar intercepts
 * - Tracker updates and bearing smoothing
 * - Weapon detection and tracking
 * - Classification
 */

import {
  normalizeAngle,
  gaussianRandom,
  lerpAngle,
  relativeBearing,
  isInBaffles,
  distanceYards,
} from '../lib/math';
import { ACOUSTICS } from '../config/AcousticConstants';
import { AcousticsEngine } from '../lib/AcousticsEngine';
import { generateNoisySolution } from '../lib/SolutionAI';
import type {
  Contact,
  Torpedo,
  SensorReading,
  Tracker,
  ActiveIntercept,
  OwnShipHistory,
} from '../store/types';

// Local type definition
interface LogEntry {
  message: string;
  timestamp: number;
  type: 'INFO' | 'ALERT';
}

// Sensor Constants
const BEARING_NOISE_STDEV = 1.0; // degrees
const BEARING_SMOOTHING_ALPHA = 0.1;
const CLASSIFICATION_TIME = 15; // seconds
const FTOW_TIMEOUT = 30; // seconds
const WEAPON_PASSIVE_DETECTION_RANGE = 3000; // yards
const WEAPON_PASSIVE_DETECTION_RANGE_BAFFLES = 1000; // yards
const WEAPON_ACTIVE_DETECTION_RANGE = 4000; // yards

// ============================================================================
// PASSIVE SONAR
// ============================================================================

export interface PassiveSonarContext {
  ownship: {
    x: number;
    y: number;
    heading: number;
  };
  contacts: Contact[];
}

/**
 * Generates passive sonar sensor readings from contacts
 */
export function generatePassiveSensorReadings(
  context: PassiveSonarContext
): SensorReading[] {
  const readings: SensorReading[] = [];

  for (const contact of context.contacts) {
    // Skip destroyed contacts
    if (contact.status === 'DESTROYED') continue;

    // Calculate true bearing
    const dx = contact.x - context.ownship.x;
    const dy = contact.y - context.ownship.y;
    const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    const trueBearing = normalizeAngle(90 - mathAngleDeg);

    const relBearing = relativeBearing(trueBearing, context.ownship.heading);

    // Baffles: Blind in rear 60 degrees (150 to 210 relative)
    if (isInBaffles(relBearing)) {
      continue;
    }

    // Add noise (Gaussian with 1 degree std dev)
    const noisyBearing = normalizeAngle(gaussianRandom(relBearing, BEARING_NOISE_STDEV));

    readings.push({
      contactId: contact.id,
      bearing: noisyBearing,
    });
  }

  return readings;
}

// ============================================================================
// ACTIVE SONAR
// ============================================================================

export interface ActiveSonarContext {
  gameTime: number;
  ownship: {
    x: number;
    y: number;
  };
  contacts: Contact[];
  activeIntercepts: ActiveIntercept[];
  delta: number;
}

export interface ActiveSonarResult {
  updatedContacts: Contact[];
  activeIntercepts: ActiveIntercept[];
  logs: LogEntry[];
  enemyFireRequests: Array<{ shooterId: string; x: number; y: number; heading: number }>;
}

/**
 * Processes active sonar pings from contacts
 */
export function processActiveSonar(context: ActiveSonarContext): ActiveSonarResult {
  const updatedContacts: Contact[] = [];
  let activeIntercepts = [...context.activeIntercepts];
  const logs: LogEntry[] = [];
  const enemyFireRequests: Array<{
    shooterId: string;
    x: number;
    y: number;
    heading: number;
  }> = [];

  for (const contact of context.contacts) {
    if (contact.status === 'DESTROYED' || !contact.isActivePingEnabled) {
      updatedContacts.push(contact);
      continue;
    }

    let updatedContact = { ...contact };
    const pingInterval = ACOUSTICS.ACTIVE_SONAR.INTERVAL;

    // Decrement timer
    if (updatedContact.activePingTimer === undefined) updatedContact.activePingTimer = 0;
    updatedContact.activePingTimer -= (1 / 60) * context.delta;

    if (updatedContact.activePingTimer <= 0) {
      // PING!
      updatedContact.activePingTimer = pingInterval;

      const dx = context.ownship.x - contact.x;
      const dy = context.ownship.y - contact.y;
      const distYards = Math.sqrt(dx * dx + dy * dy) / 3;
      const deepWater = true;

      // 1. One-Way (Intercept) - Player hears it
      const interceptSignal = AcousticsEngine.calculateActiveOneWay(
        ACOUSTICS.ACTIVE_SONAR.SL,
        distYards,
        deepWater
      );
      const interceptThreshold = 0;

      if (interceptSignal > interceptThreshold) {
        const dxSource = contact.x - context.ownship.x;
        const dySource = contact.y - context.ownship.y;
        const mathAngle = Math.atan2(dySource, dxSource) * (180 / Math.PI);
        const bearingToSource = normalizeAngle(90 - mathAngle);

        activeIntercepts.push({
          bearing: bearingToSource,
          timestamp: context.gameTime,
          sourceId: contact.id,
        });

        if (interceptSignal > 10) {
          logs.push({
            message: `Conn, Sonar: HIGH FREQUENCY INTERCEPT! Bearing ${Math.round(bearingToSource)}!`,
            type: 'ALERT',
            timestamp: context.gameTime,
          });
        }
      }

      // 2. Two-Way (Return) - Enemy hears us
      const returnSignal = AcousticsEngine.calculateActiveTwoWay(
        ACOUSTICS.ACTIVE_SONAR.SL,
        distYards,
        ACOUSTICS.OWNSHIP_TARGET_STRENGTH,
        deepWater
      );

      const detectionThreshold = 0;
      if (returnSignal > detectionThreshold && contact.type === 'ENEMY') {
        if (distYards < 6000) {
          if (!updatedContact.torpedoCooldown || updatedContact.torpedoCooldown <= 0) {
            updatedContact.aiMode = 'ATTACK';
            logs.push({
              message: `Conn, Sonar: Active Return Detected by ${contact.id}! Launch Transient!`,
              type: 'ALERT',
              timestamp: context.gameTime,
            });
          }
        }
      }
    }

    updatedContacts.push(updatedContact);

    // Check if this contact just fired
    if (updatedContact.aiMode === 'EVADE' && updatedContact.torpedoCooldown === 600) {
      const dx = context.ownship.x - contact.x;
      const dy = context.ownship.y - contact.y;
      const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);
      const bearingToOwnship = normalizeAngle(90 - angleToOwnship);

      enemyFireRequests.push({
        shooterId: contact.id,
        x: contact.x,
        y: contact.y,
        heading: bearingToOwnship,
      });
    }
  }

  // Cleanup old intercepts (> 2 seconds)
  activeIntercepts = activeIntercepts.filter(
    (i) => context.gameTime - i.timestamp < 2.0
  );

  return {
    updatedContacts,
    activeIntercepts,
    logs,
    enemyFireRequests,
  };
}

// ============================================================================
// WEAPON DETECTION
// ============================================================================

export interface WeaponDetectionContext {
  gameTime: number;
  ownship: {
    x: number;
    y: number;
    heading: number;
  };
  torpedoes: Torpedo[];
  existingTrackers: Tracker[];
}

export interface WeaponDetectionResult {
  weaponTrackers: Tracker[];
  incomingTorpedoDetected: boolean;
  logs: LogEntry[];
}

/**
 * Detects incoming hostile torpedoes and creates/updates weapon trackers
 */
export function detectWeapons(context: WeaponDetectionContext): WeaponDetectionResult {
  const weaponTrackers: Tracker[] = [];
  let incomingTorpedoDetected = false;
  const logs: LogEntry[] = [];

  for (const torp of context.torpedoes) {
    if (torp.status !== 'RUNNING' || !torp.isHostile) continue;

    const dx = torp.position.x - context.ownship.x;
    const dy = torp.position.y - context.ownship.y;
    const distYards = Math.sqrt(dx * dx + dy * dy) / 3;

    // Calculate bearing
    const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    const trueBearing = normalizeAngle(90 - mathAngle);
    const relBearing = relativeBearing(trueBearing, context.ownship.heading);

    // Check baffles
    const inBaffles = isInBaffles(relBearing);

    const active = torp.searchMode === 'ACTIVE' && distYards < WEAPON_ACTIVE_DETECTION_RANGE;
    const passive = distYards < (inBaffles ? WEAPON_PASSIVE_DETECTION_RANGE_BAFFLES : WEAPON_PASSIVE_DETECTION_RANGE);

    if (active || passive) {
      incomingTorpedoDetected = true;

      const trackerId = `W-${torp.id}`;

      // Check if tracker already exists
      let tracker = context.existingTrackers.find((t) => t.id === trackerId);

      // Solution position (add noise for passive)
      let solX = torp.position.x;
      let solY = torp.position.y;
      if (!active) {
        solX += gaussianRandom(0, 50);
        solY += gaussianRandom(0, 50);
      }

      if (!tracker) {
        // Create new tracker
        logs.push({
          message: `Conn, Sonar: TORPEDO DETECTED! Bearing ${Math.round(trueBearing)}!`,
          timestamp: context.gameTime,
          type: 'ALERT',
        });

        tracker = {
          id: trackerId,
          kind: 'WEAPON',
          currentBearing: relBearing,
          displayBearing: relBearing,
          bearingHistory: [],
          solution: {
            legs: [
              {
                startTime: context.gameTime,
                startRange: distYards,
                startBearing: trueBearing,
                course: torp.heading,
                speed: torp.speed,
                startOwnShip: {
                  x: context.ownship.x,
                  y: context.ownship.y,
                  heading: context.ownship.heading,
                },
              },
            ],
            speed: torp.speed,
            range: distYards,
            course: torp.heading,
            bearing: trueBearing,
            anchorTime: context.gameTime,
            anchorOwnShip: {
              x: context.ownship.x,
              y: context.ownship.y,
              heading: context.ownship.heading,
            },
            computedWorldX: solX,
            computedWorldY: solY,
          },
          classificationStatus: 'CLASSIFIED',
          timeToClassify: 0,
          classification: 'TORPEDO',
          creationTime: context.gameTime,
          lastInteractionTime: context.gameTime,
        };
      } else {
        // Update existing weapon tracker with smoothing
        let diff = relBearing - (tracker.displayBearing !== undefined ? tracker.displayBearing : relBearing);
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        const smoothed =
          (tracker.displayBearing !== undefined ? tracker.displayBearing : relBearing) +
          diff * BEARING_SMOOTHING_ALPHA;

        tracker = {
          ...tracker,
          currentBearing: relBearing,
          displayBearing: normalizeAngle(smoothed),
          solution: {
            ...tracker.solution,
            speed: torp.speed,
            range: distYards,
            course: torp.heading,
            bearing: trueBearing,
            anchorTime: context.gameTime,
            anchorOwnShip: {
              x: context.ownship.x,
              y: context.ownship.y,
              heading: context.ownship.heading,
            },
            computedWorldX: solX,
            computedWorldY: solY,
          },
        };
      }

      weaponTrackers.push(tracker);
    }
  }

  return {
    weaponTrackers,
    incomingTorpedoDetected,
    logs,
  };
}

// ============================================================================
// TRACKER UPDATES
// ============================================================================

export interface TrackerUpdateContext {
  gameTime: number;
  ownship: {
    x: number;
    y: number;
    heading: number;
  };
  sensorReadings: SensorReading[];
  contacts: Contact[];
  delta: number;
}

export interface TrackerUpdateResult {
  updatedTracker: Tracker;
  logs: LogEntry[];
}

/**
 * Updates a tracker with sensor data, smoothing, and classification
 */
export function updateTracker(
  tracker: Tracker,
  context: TrackerUpdateContext
): TrackerUpdateResult {
  let updatedTracker = { ...tracker };
  const logs: LogEntry[] = [];

  // Follow contact if locked
  if (updatedTracker.contactId) {
    const reading = context.sensorReadings.find((r) => r.contactId === updatedTracker.contactId);
    if (reading) {
      updatedTracker.currentBearing = reading.bearing;
    }
  }

  // Bearing smoothing
  const target = updatedTracker.currentBearing;
  const smoothed = lerpAngle(
    updatedTracker.displayBearing !== undefined ? updatedTracker.displayBearing : target,
    target,
    BEARING_SMOOTHING_ALPHA
  );
  updatedTracker.displayBearing = smoothed;

  // Classification
  if (updatedTracker.classificationStatus === 'PENDING') {
    updatedTracker.timeToClassify -= (1 / 60) * context.delta;
    if (updatedTracker.timeToClassify <= 0) {
      updatedTracker.classificationStatus = 'CLASSIFIED';

      const contact = context.contacts.find((c) => c.id === updatedTracker.contactId);
      const type = contact?.classification || 'UNKNOWN';
      updatedTracker.classification = type;

      const isHostile = type === 'SUB';
      logs.push({
        message: `Conn, Sonar: Contact ${updatedTracker.id} classified as ${type}.`,
        timestamp: context.gameTime,
        type: isHostile ? 'ALERT' : 'INFO',
      });
    }
  }

  // Automated FTOW (Safety Net)
  if (
    updatedTracker.kind !== 'WEAPON' &&
    updatedTracker.contactId &&
    !updatedTracker.isAutoSolution &&
    updatedTracker.creationTime !== undefined &&
    context.gameTime - updatedTracker.creationTime > FTOW_TIMEOUT &&
    updatedTracker.lastInteractionTime === updatedTracker.creationTime
  ) {
    const contact = context.contacts.find((c) => c.id === updatedTracker.contactId);
    if (contact) {
      const noisySol = generateNoisySolution(contact, context.gameTime, context.ownship);
      updatedTracker.solution = noisySol;
      updatedTracker.isAutoSolution = true;

      logs.push({
        message: `FTOW: MLE APPLIED on ${updatedTracker.id}`,
        type: 'INFO',
        timestamp: context.gameTime,
      });
    }
  }

  return { updatedTracker, logs };
}
