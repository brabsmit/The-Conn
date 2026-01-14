/**
 * Ownship Physics Phase
 * Handles ownship movement, depth changes, and resource consumption
 */

import { normalizeAngle, FEET_PER_KNOT_PER_TICK } from '../math';
import type { Transient } from '../../store/types';

// Physics constants
const TURN_RATE = 0.5; // degrees per tick
const ACCELERATION = 0.05; // knots per tick
const DECELERATION = 0.05; // knots per tick
const DIVE_RATE = 1.0; // feet per tick
const ASCENT_RATE = 1.0; // feet per tick

export interface OwnshipPhysicsInput {
  heading: number;
  speed: number;
  depth: number;
  x: number;
  y: number;
  fuel: number;
  battery: number;
  orderedHeading: number;
  orderedSpeed: number;
  orderedDepth: number;
  transients: Transient[];
  gameTime: number;
  delta: number;
}

export interface OwnshipPhysicsOutput {
  heading: number;
  speed: number;
  depth: number;
  x: number;
  y: number;
  fuel: number;
  battery: number;
  ownshipNoiseLevel: number;
  cavitating: boolean;
}

/**
 * Updates ownship physics including position, heading, speed, depth, and resources
 */
export const updateOwnshipPhysics = (input: OwnshipPhysicsInput): OwnshipPhysicsOutput => {
  let newHeading = input.heading;
  let newSpeed = input.speed;
  let newDepth = input.depth;

  // Update Heading
  if (input.heading !== input.orderedHeading) {
    const diff = input.orderedHeading - input.heading;
    let turnAmount = diff;

    // Handle wrapping for shortest turn
    if (diff > 180) turnAmount = diff - 360;
    if (diff < -180) turnAmount = diff + 360;

    const maxTurn = TURN_RATE * input.delta;
    if (Math.abs(turnAmount) < maxTurn) {
      newHeading = input.orderedHeading;
    } else {
      newHeading += Math.sign(turnAmount) * maxTurn;
    }
    newHeading = normalizeAngle(newHeading);
  }

  // Update Speed
  if (input.speed !== input.orderedSpeed) {
    const diff = input.orderedSpeed - input.speed;
    const rate = (diff > 0 ? ACCELERATION : DECELERATION) * input.delta;
    if (Math.abs(diff) < rate) {
      newSpeed = input.orderedSpeed;
    } else {
      newSpeed += Math.sign(diff) * rate;
    }
  }

  // Update Depth
  if (input.depth !== input.orderedDepth) {
    const diff = input.orderedDepth - input.depth;
    const rate = (diff > 0 ? DIVE_RATE : ASCENT_RATE) * input.delta;
    if (Math.abs(diff) < rate) {
      newDepth = input.orderedDepth;
    } else {
      newDepth += Math.sign(diff) * rate;
    }
  }

  // Update Position (Simple 2D kinematics)
  const radHeading = (newHeading * Math.PI) / 180;
  const distance = newSpeed * FEET_PER_KNOT_PER_TICK * input.delta;
  const newX = input.x + distance * Math.sin(radHeading);
  const newY = input.y + distance * Math.cos(radHeading);

  // Resource Consumption
  let newFuel = input.fuel;
  let newBattery = input.battery;

  if (newSpeed > 0) {
    // Arbitrary consumption rates
    const consumption = (newSpeed / 30.0) * 0.01 * input.delta;
    newFuel = Math.max(0, newFuel - consumption);
    newBattery = Math.max(0, newBattery - consumption);
  }

  // Noise Calculation
  const baseNoise = 0.1;
  const flowNoise = (newSpeed / 30.0) * 0.4;
  const cavitationThreshold = 12.0;
  const isCavitating = newSpeed > cavitationThreshold;
  const cavitationNoise = isCavitating ? 0.5 : 0;
  const activeTransients = input.transients.filter(
    (t) => input.gameTime - t.startTime < t.duration
  );
  const transientNoise = activeTransients.reduce((sum, t) => sum + t.magnitude, 0);
  const totalNoise = baseNoise + flowNoise + cavitationNoise + transientNoise;

  return {
    heading: newHeading,
    speed: newSpeed,
    depth: newDepth,
    x: newX,
    y: newY,
    fuel: newFuel,
    battery: newBattery,
    ownshipNoiseLevel: totalNoise,
    cavitating: isCavitating,
  };
};
