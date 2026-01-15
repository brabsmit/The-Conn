import {
  FEET_PER_KNOT_SEC,
  YARDS_TO_FEET,
  normalizeAngle,
  getShortestAngle
} from './math';

export { FEET_PER_KNOT_SEC, YARDS_TO_FEET, normalizeAngle, getShortestAngle };

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
  legs: {
    startTime: number;
    startRange: number;
    startBearing: number;
    course: number;
    speed: number;
    startOwnShip: { x: number, y: number, heading: number };
  }[];
  speed: number;
  range: number;
  course: number;
  bearing: number;
  anchorTime: number;
  anchorOwnShip: OwnShipState;
}

/**
 * Calculates the target's world position at a specific time based on the solution legs.
 */
export const calculateTargetPosition = (
  solution: TMASolution,
  time: number
): Position => {
  // If legs exist, use Multi-Leg logic. Otherwise fallback to legacy snapshot.
  if (solution.legs && solution.legs.length > 0) {
      // Find the leg active at 'time' or the last leg if 'time' is in the future
      // We assume legs are sorted by startTime ascending.

      // Find active leg
      // Active Leg is the last leg that started <= time.
      // If time is before first leg, use first leg (back project).

      let activeLeg = solution.legs[0];
      for (let i = 0; i < solution.legs.length; i++) {
          if (solution.legs[i].startTime <= time) {
              activeLeg = solution.legs[i];
          } else {
              break; // Future legs don't apply
          }
      }

      // Calculate Active Leg Origin
      const legBearingRad = (activeLeg.startBearing * Math.PI) / 180;
      const legRangeFt = activeLeg.startRange * 3;
      const legRelX = legRangeFt * Math.sin(legBearingRad);
      const legRelY = legRangeFt * Math.cos(legBearingRad);

      const legOriginX = activeLeg.startOwnShip.x + legRelX;
      const legOriginY = activeLeg.startOwnShip.y + legRelY;

      // Project from active leg start
      const dt = time - activeLeg.startTime;
      const speedFtSec = activeLeg.speed * FEET_PER_KNOT_SEC;
      const courseRad = (activeLeg.course * Math.PI) / 180;

      const dx = speedFtSec * dt * Math.sin(courseRad);
      const dy = speedFtSec * dt * Math.cos(courseRad);

      return {
          x: legOriginX + dx,
          y: legOriginY + dy
      };

  } else {
      // Legacy Fallback
      const { anchorTime, anchorOwnShip, range, bearing, course, speed } = solution;
      const bearingRad = (bearing * Math.PI) / 180;
      const rangeFt = range * 3;
      const relX = rangeFt * Math.sin(bearingRad);
      const relY = rangeFt * Math.cos(bearingRad);
      const targetAnchorX = anchorOwnShip.x + relX;
      const targetAnchorY = anchorOwnShip.y + relY;
      const dt = time - anchorTime;
      const speedFtSec = speed * FEET_PER_KNOT_SEC;
      const courseRad = (course * Math.PI) / 180;
      const dx = speedFtSec * dt * Math.sin(courseRad);
      const dy = speedFtSec * dt * Math.cos(courseRad);

      return {
        x: targetAnchorX + dx,
        y: targetAnchorY + dy
      };
  }
};

/**
 * Calculates a projected solution (Range/Bearing/AOB) relative to OwnShip at a given time.
 * Used for Fire Control solutions.
 */
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

export const calculateSolutionCPA = (
  solution: TMASolution,
  ownShip: { x: number; y: number; heading: number; speed: number },
  currentTime: number
) => {
  // 1. Get Target Position at Current Time
  const targetPos = calculateTargetPosition(solution, currentTime);

  // 2. Get Target Velocity Vector
  let targetSpeed = solution.speed;
  let targetCourse = solution.course;

  if (solution.legs && solution.legs.length > 0) {
      let activeLeg = solution.legs[0];
      for (let i = 0; i < solution.legs.length; i++) {
           if (solution.legs[i].startTime <= currentTime) {
               activeLeg = solution.legs[i];
           } else {
               break;
           }
      }
      targetSpeed = activeLeg.speed;
      targetCourse = activeLeg.course;
  }

  const tSpeedFt = targetSpeed * FEET_PER_KNOT_SEC;
  const tCourseRad = (targetCourse * Math.PI) / 180;
  const Vtx = tSpeedFt * Math.sin(tCourseRad);
  const Vty = tSpeedFt * Math.cos(tCourseRad);

  // 3. OwnShip Velocity
  const oSpeedFt = ownShip.speed * FEET_PER_KNOT_SEC;
  const oHeadingRad = (ownShip.heading * Math.PI) / 180;
  const Vox = oSpeedFt * Math.sin(oHeadingRad);
  const Voy = oSpeedFt * Math.cos(oHeadingRad);

  // 4. Relative Position (Target - Own)
  const Rx = targetPos.x - ownShip.x;
  const Ry = targetPos.y - ownShip.y;

  // 5. Relative Velocity (Target - Own)
  const Vx = Vtx - Vox;
  const Vy = Vty - Voy;

  // 6. Calculate Time to CPA
  // t_cpa = -(R . V) / |V|^2
  const V_dot_V = Vx * Vx + Vy * Vy;
  const R_dot_V = Rx * Vx + Ry * Vy;

  let t_cpa = 0;
  if (V_dot_V > 0.0001) {
      t_cpa = -R_dot_V / V_dot_V;
  }

  // Clamp to future
  const t_clamp = Math.max(0, t_cpa);

  // 7. Calculate Position at CPA
  const CpaX = Rx + Vx * t_clamp;
  const CpaY = Ry + Vy * t_clamp; // Relative position at CPA

  const rangeSq = CpaX * CpaX + CpaY * CpaY;
  const cpaRange = Math.sqrt(rangeSq) / 3; // Yards

  // CPA Bearing (from OwnShip)
  // Relative CPA position is (T_cpa - O_cpa).
  // Bearing is atan2(x, y).
  const cpaBearing = normalizeAngle(Math.atan2(CpaX, CpaY) * (180 / Math.PI));

  return {
      range: cpaRange,
      time: t_clamp,
      bearing: cpaBearing
  };
};
