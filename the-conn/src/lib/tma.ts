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
 * Normalizes an angle to 0-359 degrees
 */
export const normalizeAngle = (angle: number): number => {
  return (angle % 360 + 360) % 360;
};

/**
 * Returns the shortest difference between two angles (-180 to 180)
 */
export const getShortestAngle = (target: number, source: number): number => {
  const diff = (target - source + 540) % 360 - 180;
  return diff;
};

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

      // 1. Start from Leg 0
      let currentLeg = solution.legs[0];

      // Calculate World Start Position for Leg 0
      const bearingRad = (currentLeg.startBearing * Math.PI) / 180;
      const rangeFt = currentLeg.startRange * 3;
      const relX = rangeFt * Math.sin(bearingRad);
      const relY = rangeFt * Math.cos(bearingRad);

      let currentX = currentLeg.startOwnShip.x + relX;
      let currentY = currentLeg.startOwnShip.y + relY;
      let currentTime = currentLeg.startTime;

      // 2. Walk through legs
      for (let i = 0; i < solution.legs.length; i++) {
          const leg = solution.legs[i];
          const nextLeg = solution.legs[i+1];

          // Determine end time of this segment
          // If there is a next leg, end time is nextLeg.startTime
          // If we are aiming for a time BEFORE nextLeg.startTime, we stop in this leg.

          let endTimeForSegment = time;
          if (nextLeg && nextLeg.startTime < time) {
              endTimeForSegment = nextLeg.startTime;
          }

          // If the requested time is BEFORE this leg started (historical query), we might need to project backwards?
          // Or we just start from the first leg and project backwards if time < legs[0].startTime.
          // But here we are iterating.

          // Calculate movement in this segment
          // Note: If i > 0, we need to ensure continuity.
          // The prompt says: "User clicks New Leg... System calculates Target's position at Now. That position becomes startRange/startBearing for Leg 2."
          // This implies Leg 2's start pos IS Leg 1's end pos.
          // However, we store startRange/startBearing relative to anchorOwnShip for EACH leg.
          // This creates a potential discontinuity if the user edits previous legs.
          // "User adjusts only Course/Speed for the new leg."
          // If user edits Leg 1 Course, Leg 2 Start Pos (which is fixed) might not align with Leg 1 End Pos anymore.
          // The prompt says: "Allows switching between segments to refine past guesses."
          // If I change Leg 1, Leg 2 *start* is technically a new anchor snapshot taken at Leg 2 start time.
          // Does Leg 2 move?
          // "Leg 2 (The Turn): User clicks 'New Leg'. System calculates the Target's position at Now. That position becomes startRange / startBearing for Leg 2."
          // This implies Leg 2 is anchored to the *computed* position at that moment.
          // If I go back and change Leg 1, Leg 2's anchor remains where it was set. The track will be discontinuous (jump).
          // This is actually standard for "Dogleg" TMA tools if not strictly constrained.
          // However, a "Multi-Leg Time-Based solution solver" usually implies a continuous track.
          // But implementing continuous constraint solver is hard.
          // Given the prompt "Allows switching between segments to refine past guesses", let's assume discontinuous is acceptable OR
          // we treat each leg as independent projection from its anchor.
          // AND we assume the code just calculates position based on the leg that covers the time.

          // Let's look at coverage:
          // Time < Leg 0 Start: Back project Leg 0.
          // Leg N Start <= Time < Leg N+1 Start: Project Leg N.
          // Time >= Leg Last Start: Project Leg Last.

          // So we don't need to walk and integrate. We just find the active leg.
      }

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
