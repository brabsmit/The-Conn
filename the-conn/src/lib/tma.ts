export const FEET_PER_KNOT_SEC = 1.68;

export interface Position {
  x: number;
  y: number;
}

export interface OwnShipState {
  x: number;
  y: number;
  heading: number;
}

export interface TMASolution {
  speed: number;
  range: number;
  course: number;
  bearing: number;
  anchorTime: number;
  anchorOwnShip: OwnShipState;
}

/**
 * Normalizes an angle to 0-359 degrees
 */
export const normalizeAngle = (angle: number): number => {
  return (angle % 360 + 360) % 360;
};

/**
 * Calculates the target's world position at a specific time based on the solution anchor.
 */
export const calculateTargetPosition = (
  solution: TMASolution,
  time: number
): Position => {
  const { anchorTime, anchorOwnShip, range, bearing, course, speed } = solution;

  // 1. Calculate Target Position at Anchor Time
  // Convert polar (bearing, range) relative to OwnShip to Cartesian world coordinates
  // Bearing is 0-359 (0=North/+Y, 90=East/+X)
  // True Bearing = Relative Bearing + OwnShip Heading?
  // Usually 'Bearing' in solution is True Bearing?
  // In the UI, the slider usually sets True Bearing or Relative?
  // The store uses 'currentBearing' which is Relative to Ownship in the code I read?
  // Wait, let's check useSubmarineStore again.
  // "const relativeBearing = normalizeAngle(trueBearing - newHeading);"
  // "acc.push({ ... bearing: noisyBearing });" (noisy relative bearing)
  // Tracker.currentBearing updates from reading.bearing.
  // So Tracker.currentBearing is RELATIVE.

  // However, TMA solutions are usually in TRUE bearings (or at least the plot uses True).
  // If the user inputs Bearing via slider, is it True or Relative?
  // If I assume True Bearing for the solution storage, it makes dead reckoning easier.
  // If I assume Relative, I need to know OwnShip Heading at Anchor to convert to True.
  // Since we store anchorOwnShip, we can support either.
  // Let's assume the Solution Bearing is TRUE Bearing for stability.
  // But wait, if the user "Marks", we grab the current sensor bearing (which is Relative).
  // We should convert it to True immediately upon Mark.
  // Solution: bearing is TRUE.

  const bearingRad = (bearing * Math.PI) / 180;
  const rangeFt = range * 3; // 1 yard = 3 feet

  const relX = rangeFt * Math.sin(bearingRad);
  const relY = rangeFt * Math.cos(bearingRad);

  const targetAnchorX = anchorOwnShip.x + relX;
  const targetAnchorY = anchorOwnShip.y + relY;

  // 2. Project to 'time'
  const dt = time - anchorTime; // seconds
  const speedFtSec = speed * FEET_PER_KNOT_SEC;
  const courseRad = (course * Math.PI) / 180;

  const dx = speedFtSec * dt * Math.sin(courseRad);
  const dy = speedFtSec * dt * Math.cos(courseRad);

  return {
    x: targetAnchorX + dx,
    y: targetAnchorY + dy
  };
};

export const calculateProjectedSolution = (
  solution: TMASolution,
  currentOwnShip: OwnShipState,
  currentTime: number
) => {
  // 1. Get Target World Position at currentTime
  const targetPos = calculateTargetPosition(solution, currentTime);

  // 2. Calculate Relative Vector
  const dx = targetPos.x - currentOwnShip.x;
  const dy = targetPos.y - currentOwnShip.y;

  // 3. Calculate Range (yards)
  const rangeFt = Math.sqrt(dx * dx + dy * dy);
  const calcRange = rangeFt / 3;

  // 4. Calculate True Bearing
  // atan2(x, y) gives angle from Y axis (North)
  let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
  trueBearing = normalizeAngle(trueBearing);

  // 5. Calculate Relative Bearing (optional, but requested "Calc Bearing" usually means True or Rel?)
  // Usually TMA outputs True Bearing. Let's return True Bearing.
  // If needed we can return Relative.
  // The UI just says "Calc Bearing".

  // 6. Calculate AOB (Angle on Bow)
  // AOB is the angle of OwnShip relative to Target's Bow.
  // Formula: Target Course - True Bearing (from OwnShip to Target) + 180.
  // Basically: Where am I looking from the target's perspective?
  // Wait. AOB is usually 0-180 Left/Right.
  // "Angle on the Bow": 0 is Bow, 180 is Stern.
  // Target Course is where Target is going.
  // True Bearing is direction TO Target.
  // Reciprocal Bearing is direction FROM Target TO OwnShip.
  // AOB = Reciprocal Bearing - Target Course.
  // Example: Target heading North (0). Ownship is East (90).
  // True Bearing to Target = 0 (North).? No, Ownship is East of Target? No.
  // Let's draw.
  // Target at (0,0), Heading 0.
  // Ownship at (0, -100) (South).
  // True Bearing Own->Tgt = 0.
  // Reciprocal Tgt->Own = 180.
  // Target looks back (180).
  // AOB should be 180 (Stern).
  // Formula: (Bearing + 180) - Course.
  // (0 + 180) - 0 = 180. Correct.

  // Example 2: Target Heading 0. Ownship at (-100, 0) (West).
  // True Bearing Own->Tgt = 90 (East).
  // Reciprocal = 270 (West).
  // Target looks Left (270).
  // AOB = 270 - 0 = 270.
  // 270 is "Left 90" or "Port 90".

  const aobRaw = normalizeAngle((trueBearing + 180) - solution.course);

  return {
    calcRange,
    calcBearing: trueBearing,
    calcAOB: aobRaw
  };
};
