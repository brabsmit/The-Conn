/**
 * PhysicsEngine - Handles all physics simulations
 * - Ownship kinematics (heading, speed, depth)
 * - Contact movement
 * - Torpedo movement and guidance
 */

import { normalizeAngle, FEET_PER_KNOT_PER_TICK, checkCollision } from '../lib/math';
import type { Contact, Torpedo } from '../store/types';

// Physics constants
const TURN_RATE = 0.5; // degrees per tick
const ACCELERATION = 0.05; // knots per tick
const DECELERATION = 0.05; // knots per tick
const DIVE_RATE = 1.0; // feet per tick
const ASCENT_RATE = 1.0; // feet per tick
const TORPEDO_TURN_RATE = 3.0; // degrees per tick
const TORPEDO_ACCELERATION = 0.5; // knots per tick
const TORPEDO_MAX_SPEED = 45; // knots
const TORPEDO_MAX_RANGE_YARDS = 20000; // yards
const SEEKER_RANGE_YARDS = 2000; // yards
const SEEKER_FOV_DEGREES = 45; // degrees
const PROXIMITY_FUSE_RADIUS_FEET = 120; // feet (40 yards)
const SEARCH_WIDTH_DEGREES = 20; // degrees
const SEARCH_PERIOD_YARDS = 2000; // yards

// ============================================================================
// OWNSHIP KINEMATICS
// ============================================================================

export interface OwnshipState {
  heading: number;
  speed: number;
  depth: number;
  x: number;
  y: number;
  orderedHeading: number;
  orderedSpeed: number;
  orderedDepth: number;
}

export interface OwnshipUpdate {
  heading: number;
  speed: number;
  depth: number;
  x: number;
  y: number;
}

/**
 * Updates ownship kinematics (heading, speed, depth, position)
 */
export function updateOwnshipKinematics(
  state: OwnshipState,
  delta: number = 1
): OwnshipUpdate {
  let newHeading = state.heading;
  let newSpeed = state.speed;
  let newDepth = state.depth;

  // Update Heading
  if (state.heading !== state.orderedHeading) {
    const diff = state.orderedHeading - state.heading;
    let turnAmount = diff;

    // Handle wrapping for shortest turn
    if (diff > 180) turnAmount = diff - 360;
    if (diff < -180) turnAmount = diff + 360;

    const maxTurn = TURN_RATE * delta;
    if (Math.abs(turnAmount) < maxTurn) {
      newHeading = state.orderedHeading;
    } else {
      newHeading += Math.sign(turnAmount) * maxTurn;
    }
    newHeading = normalizeAngle(newHeading);
  }

  // Update Speed
  if (state.speed !== state.orderedSpeed) {
    const diff = state.orderedSpeed - state.speed;
    const rate = (diff > 0 ? ACCELERATION : DECELERATION) * delta;
    if (Math.abs(diff) < rate) {
      newSpeed = state.orderedSpeed;
    } else {
      newSpeed += Math.sign(diff) * rate;
    }
  }

  // Update Depth
  if (state.depth !== state.orderedDepth) {
    const diff = state.orderedDepth - state.depth;
    const rate = (diff > 0 ? DIVE_RATE : ASCENT_RATE) * delta;
    if (Math.abs(diff) < rate) {
      newDepth = state.orderedDepth;
    } else {
      newDepth += Math.sign(diff) * rate;
    }
  }

  // Update Position (Simple 2D kinematics)
  const radHeading = (newHeading * Math.PI) / 180;
  const distance = newSpeed * FEET_PER_KNOT_PER_TICK * delta;
  const newX = state.x + distance * Math.sin(radHeading);
  const newY = state.y + distance * Math.cos(radHeading);

  return {
    heading: newHeading,
    speed: newSpeed,
    depth: newDepth,
    x: newX,
    y: newY,
  };
}

// ============================================================================
// CONTACT MOVEMENT
// ============================================================================

/**
 * Updates contact position based on heading and speed
 */
export function updateContactPosition(
  contact: Contact,
  delta: number = 1
): { x: number; y: number } {
  if (contact.speed === undefined || contact.heading === undefined) {
    return { x: contact.x, y: contact.y };
  }

  const radHeading = (contact.heading * Math.PI) / 180;
  const distance = contact.speed * FEET_PER_KNOT_PER_TICK * delta;

  return {
    x: contact.x + distance * Math.sin(radHeading),
    y: contact.y + distance * Math.cos(radHeading),
  };
}

// ============================================================================
// TORPEDO PHYSICS
// ============================================================================

export interface TorpedoUpdateContext {
  ownshipX: number;
  ownshipY: number;
  contacts: Contact[];
  delta: number;
}

export interface TorpedoUpdate {
  speed: number;
  heading: number;
  position: { x: number; y: number };
  distanceTraveled: number;
  status: Torpedo['status'];
  activeTargetId: string | undefined;
  collision?: {
    targetId: string;
    position: { x: number; y: number };
  };
}

/**
 * Updates torpedo physics, guidance, and collision detection
 */
export function updateTorpedo(
  torpedo: Torpedo,
  context: TorpedoUpdateContext
): TorpedoUpdate {
  if (torpedo.status !== 'RUNNING') {
    return {
      speed: torpedo.speed,
      heading: torpedo.heading,
      position: torpedo.position,
      distanceTraveled: torpedo.distanceTraveled,
      status: torpedo.status,
      activeTargetId: torpedo.activeTargetId,
    };
  }

  let newSpeed = torpedo.speed;
  let newHeading = torpedo.heading;
  let finalStatus: Torpedo['status'] = torpedo.status;
  let finalActiveTargetId = torpedo.activeTargetId;
  let collision: TorpedoUpdate['collision'] = undefined;

  // Accelerate
  if (newSpeed < TORPEDO_MAX_SPEED) {
    newSpeed += TORPEDO_ACCELERATION * context.delta;
    if (newSpeed > TORPEDO_MAX_SPEED) newSpeed = TORPEDO_MAX_SPEED;
  }

  const distThisTick = newSpeed * FEET_PER_KNOT_PER_TICK * context.delta;
  const newTotalDistance = torpedo.distanceTraveled + distThisTick / 3; // Convert to yards

  // Check max range
  if (newTotalDistance > TORPEDO_MAX_RANGE_YARDS) {
    finalStatus = 'DUD';
  }

  // Guidance logic
  if (newTotalDistance >= torpedo.enableRange && finalStatus === 'RUNNING') {
    // Try to acquire target if not already locked
    if (!finalActiveTargetId) {
      finalActiveTargetId = acquireTarget(
        torpedo,
        newHeading,
        context.ownshipX,
        context.ownshipY,
        context.contacts
      );
    }

    // Snake search pattern if not locked
    if (!finalActiveTargetId) {
      newHeading = calculateSearchHeading(torpedo, newTotalDistance, context.delta);
    }
  } else {
    // Transit phase: Turn towards gyro
    newHeading = turnTowardsHeading(newHeading, torpedo.gyroAngle, context.delta);
  }

  // Homing and collision detection
  if (finalActiveTargetId && finalStatus === 'RUNNING') {
    const targetInfo = getTargetPosition(
      finalActiveTargetId,
      context.ownshipX,
      context.ownshipY,
      context.contacts
    );

    if (targetInfo) {
      // Pure pursuit
      const dx = targetInfo.x - torpedo.position.x;
      const dy = targetInfo.y - torpedo.position.y;
      const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      newHeading = normalizeAngle(90 - mathAngle);

      // Calculate new position with homing heading
      const newRad = (newHeading * Math.PI) / 180;
      const correctedNewX = torpedo.position.x + distThisTick * Math.sin(newRad);
      const correctedNewY = torpedo.position.y + distThisTick * Math.cos(newRad);

      // Proximity fuse check
      const hit = checkCollision(
        torpedo.position.x,
        torpedo.position.y,
        correctedNewX,
        correctedNewY,
        targetInfo.x,
        targetInfo.y,
        PROXIMITY_FUSE_RADIUS_FEET
      );

      if (hit) {
        finalStatus = 'EXPLODED';
        collision = {
          targetId: finalActiveTargetId,
          position: { x: torpedo.position.x, y: torpedo.position.y },
        };
      }

      // Update position
      const finalRad = (newHeading * Math.PI) / 180;
      const finalNewX = torpedo.position.x + distThisTick * Math.sin(finalRad);
      const finalNewY = torpedo.position.y + distThisTick * Math.cos(finalRad);

      return {
        speed: newSpeed,
        heading: newHeading,
        position: { x: finalNewX, y: finalNewY },
        distanceTraveled: newTotalDistance,
        status: finalStatus,
        activeTargetId: finalActiveTargetId,
        collision,
      };
    } else {
      // Lost target
      finalActiveTargetId = undefined;
    }
  }

  // Default position update
  const finalRad = (newHeading * Math.PI) / 180;
  const finalNewX = torpedo.position.x + distThisTick * Math.sin(finalRad);
  const finalNewY = torpedo.position.y + distThisTick * Math.cos(finalRad);

  return {
    speed: newSpeed,
    heading: newHeading,
    position: { x: finalNewX, y: finalNewY },
    distanceTraveled: newTotalDistance,
    status: finalStatus,
    activeTargetId: finalActiveTargetId,
    collision,
  };
}

// ============================================================================
// TORPEDO HELPER FUNCTIONS
// ============================================================================

/**
 * Attempts to acquire a target within seeker range and FOV
 */
function acquireTarget(
  torpedo: Torpedo,
  currentHeading: number,
  ownshipX: number,
  ownshipY: number,
  contacts: Contact[]
): string | undefined {
  let bestContactId: string | undefined;
  let minDist = SEEKER_RANGE_YARDS;

  // Check designated target first
  if (torpedo.designatedTargetId) {
    if (torpedo.designatedTargetId === 'OWNSHIP') {
      const dx = ownshipX - torpedo.position.x;
      const dy = ownshipY - torpedo.position.y;
      const distToContact = Math.sqrt(dx * dx + dy * dy) / 3;
      if (distToContact < SEEKER_RANGE_YARDS) {
        const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const bearingToContact = normalizeAngle(90 - mathAngle);
        let relBearing = Math.abs(bearingToContact - currentHeading);
        if (relBearing > 180) relBearing = 360 - relBearing;

        if (relBearing < SEEKER_FOV_DEGREES) {
          return 'OWNSHIP';
        }
      }
    } else {
      const contact = contacts.find(
        (c) => c.id === torpedo.designatedTargetId && c.status !== 'DESTROYED'
      );
      if (contact) {
        const dx = contact.x - torpedo.position.x;
        const dy = contact.y - torpedo.position.y;
        const distToContact = Math.sqrt(dx * dx + dy * dy) / 3;
        if (distToContact < SEEKER_RANGE_YARDS) {
          const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
          const bearingToContact = normalizeAngle(90 - mathAngle);
          let relBearing = Math.abs(bearingToContact - currentHeading);
          if (relBearing > 180) relBearing = 360 - relBearing;

          if (relBearing < SEEKER_FOV_DEGREES) {
            return contact.id;
          }
        }
      }
    }
  }

  // Check ownship
  const dx = ownshipX - torpedo.position.x;
  const dy = ownshipY - torpedo.position.y;
  const distToOwnship = Math.sqrt(dx * dx + dy * dy) / 3;
  if (distToOwnship < SEEKER_RANGE_YARDS) {
    const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    const bearingToContact = normalizeAngle(90 - mathAngle);
    let relBearing = Math.abs(bearingToContact - currentHeading);
    if (relBearing > 180) relBearing = 360 - relBearing;

    if (relBearing < SEEKER_FOV_DEGREES && distToOwnship < minDist) {
      minDist = distToOwnship;
      bestContactId = 'OWNSHIP';
    }
  }

  // Check all contacts
  for (const contact of contacts) {
    if (contact.status === 'DESTROYED') continue;
    const dx = contact.x - torpedo.position.x;
    const dy = contact.y - torpedo.position.y;
    const distToContact = Math.sqrt(dx * dx + dy * dy) / 3;
    if (distToContact < SEEKER_RANGE_YARDS) {
      const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      const bearingToContact = normalizeAngle(90 - mathAngle);
      let relBearing = Math.abs(bearingToContact - currentHeading);
      if (relBearing > 180) relBearing = 360 - relBearing;

      if (relBearing < SEEKER_FOV_DEGREES && distToContact < minDist) {
        minDist = distToContact;
        bestContactId = contact.id;
      }
    }
  }

  return bestContactId;
}

/**
 * Calculates snake search heading when no target is locked
 */
function calculateSearchHeading(
  torpedo: Torpedo,
  totalDistance: number,
  delta: number
): number {
  const phase =
    ((totalDistance - torpedo.enableRange) % SEARCH_PERIOD_YARDS) / SEARCH_PERIOD_YARDS;
  const offset = Math.sin(phase * Math.PI * 2) * SEARCH_WIDTH_DEGREES;
  const desired = normalizeAngle(torpedo.gyroAngle + offset);
  return turnTowardsHeading(torpedo.heading, desired, delta);
}

/**
 * Turns current heading towards desired heading at max turn rate
 */
function turnTowardsHeading(current: number, desired: number, delta: number): number {
  const diff = desired - current;
  let turnAmount = diff;
  if (diff > 180) turnAmount = diff - 360;
  if (diff < -180) turnAmount = diff + 360;
  const maxTurn = TORPEDO_TURN_RATE * delta;
  if (Math.abs(turnAmount) < maxTurn) {
    return desired;
  } else {
    return normalizeAngle(current + Math.sign(turnAmount) * maxTurn);
  }
}

/**
 * Gets target position by ID
 */
function getTargetPosition(
  targetId: string,
  ownshipX: number,
  ownshipY: number,
  contacts: Contact[]
): { x: number; y: number } | null {
  if (targetId === 'OWNSHIP') {
    return { x: ownshipX, y: ownshipY };
  }

  const contact = contacts.find((c) => c.id === targetId && c.status !== 'DESTROYED');
  if (contact) {
    return { x: contact.x, y: contact.y };
  }

  return null;
}
