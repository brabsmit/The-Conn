/**
 * Shared mathematical utilities for The-Conn
 * Centralizes common calculations to avoid duplication across the codebase
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Conversion factor: feet per knot per second */
export const FEET_PER_KNOT_SEC = 1.68;

/** Conversion factor: yards to feet */
export const YARDS_TO_FEET = 3.0;

/** Conversion factor: feet per knot per tick (assuming 60 ticks/sec) */
export const FEET_PER_KNOT_PER_TICK = 0.028; // approx 1.68 ft/sec / 60 ticks/sec

// ============================================================================
// ANGLE UTILITIES
// ============================================================================

/**
 * Normalizes an angle to 0-359 degrees
 * @param angle - Angle in degrees (can be negative or > 360)
 * @returns Normalized angle in range [0, 360)
 */
export const normalizeAngle = (angle: number): number => {
  return (angle % 360 + 360) % 360;
};

/**
 * Returns the shortest difference between two angles
 * @param target - Target angle in degrees
 * @param source - Source angle in degrees
 * @returns Angle difference in range (-180, 180]
 */
export const getShortestAngle = (target: number, source: number): number => {
  const diff = (target - source + 540) % 360 - 180;
  return diff;
};

// ============================================================================
// RANDOM NUMBER GENERATION
// ============================================================================

/**
 * Generates a random number from a Gaussian (normal) distribution
 * Uses the Box-Muller transform
 * @param mean - Mean of the distribution
 * @param stdev - Standard deviation of the distribution
 * @returns Random number from N(mean, stdev)
 */
export const gaussianRandom = (mean: number, stdev: number): number => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdev + mean;
};

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Checks collision between a line segment and a circle using raycast
 * @param p1x - Start point X of line segment
 * @param p1y - Start point Y of line segment
 * @param p2x - End point X of line segment
 * @param p2y - End point Y of line segment
 * @param cx - Circle center X
 * @param cy - Circle center Y
 * @param radius - Circle radius
 * @returns true if segment intersects circle
 */
export const checkCollision = (
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  cx: number,
  cy: number,
  radius: number
): boolean => {
  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const lengthSq = dx * dx + dy * dy;

  // If segment is zero length, do point check
  if (lengthSq === 0) {
    const distSq = (p1x - cx) ** 2 + (p1y - cy) ** 2;
    return distSq < radius * radius;
  }

  // Project circle center onto line P1P2
  let t = ((cx - p1x) * dx + (cy - p1y) * dy) / lengthSq;

  // Clamp t to segment [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Find closest point on segment
  const closestX = p1x + t * dx;
  const closestY = p1y + t * dy;

  // Check distance from circle center to closest point
  const distSq = (closestX - cx) ** 2 + (closestY - cy) ** 2;
  return distSq < radius * radius;
};

// ============================================================================
// GEOMETRIC UTILITIES
// ============================================================================

/**
 * Calculates Euclidean distance between two points
 * @param x1 - First point X
 * @param y1 - First point Y
 * @param x2 - Second point X
 * @param y2 - Second point Y
 * @returns Distance in same units as input coordinates
 */
export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculates bearing from point 1 to point 2
 * @param x1 - Start point X
 * @param y1 - Start point Y
 * @param x2 - End point X
 * @param y2 - End point Y
 * @returns Bearing in degrees (0 = North, 90 = East)
 */
export const calculateBearing = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angleRad = Math.atan2(dx, dy);
  const angleDeg = (angleRad * 180) / Math.PI;
  return normalizeAngle(angleDeg);
};

/**
 * Calculates distance in yards between two points (assumes coordinates in feet)
 * @param x1 - First point X in feet
 * @param y1 - First point Y in feet
 * @param x2 - Second point X in feet
 * @param y2 - Second point Y in feet
 * @returns Distance in yards
 */
export const distanceYards = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) / YARDS_TO_FEET;
};

/**
 * Converts a mathematical angle (from Math.atan2) to a navigational bearing
 * @param mathAngle - Angle in degrees from Math.atan2 (0 = East, positive counterclockwise)
 * @returns Bearing in degrees (0 = North, 90 = East)
 */
export const mathAngleToBearing = (mathAngle: number): number => {
  return normalizeAngle(90 - mathAngle);
};

/**
 * Calculates both bearing and distance from point 1 to point 2
 * @param x1 - Start point X in feet
 * @param y1 - Start point Y in feet
 * @param x2 - End point X in feet
 * @param y2 - End point Y in feet
 * @returns Object with bearing (degrees) and distanceYards (yards)
 */
export const getBearingAndDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { bearing: number; distanceYards: number } => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const mathAngle = Math.atan2(dx, dy) * (180 / Math.PI);
  const bearing = normalizeAngle(mathAngle);
  const distYards = Math.sqrt(dx * dx + dy * dy) / YARDS_TO_FEET;
  return { bearing, distanceYards: distYards };
};

/**
 * Calculates relative bearing (difference between absolute bearing and heading)
 * @param absoluteBearing - Absolute bearing in degrees
 * @param heading - Current heading in degrees
 * @returns Relative bearing in range [0, 360)
 */
export const relativeBearing = (absoluteBearing: number, heading: number): number => {
  return normalizeAngle(absoluteBearing - heading);
};

/**
 * Checks if a relative bearing is in the baffles (blind zone behind the vessel)
 * @param relBearing - Relative bearing in degrees
 * @returns true if bearing is in baffles (150-210 degrees relative)
 */
export const isInBaffles = (relBearing: number): boolean => {
  const normalized = normalizeAngle(relBearing);
  return normalized > 150 && normalized < 210;
};

/**
 * Linear interpolation between two values
 * @param current - Current value
 * @param target - Target value
 * @param alpha - Interpolation factor [0, 1]
 * @returns Interpolated value
 */
export const lerp = (current: number, target: number, alpha: number): number => {
  return current + (target - current) * alpha;
};

/**
 * Smoothly interpolates between two angles, handling wraparound
 * @param current - Current angle in degrees
 * @param target - Target angle in degrees
 * @param alpha - Interpolation factor [0, 1]
 * @returns Interpolated angle in degrees
 */
export const lerpAngle = (current: number, target: number, alpha: number): number => {
  let diff = target - current;
  // Handle wraparound
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return normalizeAngle(current + diff * alpha);
};

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Converts speed from knots to feet per second
 * @param knots - Speed in knots
 * @returns Speed in feet per second
 */
export const knotsToFeetPerSecond = (knots: number): number => {
  return knots * FEET_PER_KNOT_SEC;
};

/**
 * Converts speed from knots to yards per second
 * @param knots - Speed in knots
 * @returns Speed in yards per second
 */
export const knotsToYardsPerSecond = (knots: number): number => {
  return knots * (FEET_PER_KNOT_SEC / YARDS_TO_FEET);
};

/**
 * Converts feet to yards
 * @param feet - Distance in feet
 * @returns Distance in yards
 */
export const feetToYards = (feet: number): number => {
  return feet / YARDS_TO_FEET;
};

/**
 * Converts yards to feet
 * @param yards - Distance in yards
 * @returns Distance in feet
 */
export const yardsToFeet = (yards: number): number => {
  return yards * YARDS_TO_FEET;
};
