import { create } from 'zustand';

interface Contact {
  id: string;
  x: number;
  y: number;
}

interface SensorReading {
  contactId: string;
  bearing: number;
}

export interface TrackerHistory {
  time: number;
  bearing: number;
}

export interface OwnShipHistory {
  time: number;
  x: number;
  y: number;
  heading: number;
}

export type Station = 'TMA' | 'WCS';

export type TimeScale = 'FAST' | 'MED' | 'SLOW';

export interface TrackerSolution {
  speed: number;
  range: number;
  course: number;
  bearing: number;
  anchorTime: number;
  anchorOwnShip: {
    x: number;
    y: number;
    heading: number;
  };
}

export interface Tracker {
  id: string;
  contactId?: string;
  currentBearing: number;
  bearingHistory: TrackerHistory[];
  solution: TrackerSolution;
}

interface SubmarineState {
  // OwnShip Data
  heading: number; // 0-359
  speed: number; // 0-30kts
  depth: number; // 0-1200ft
  x: number;
  y: number;
  ownShipHistory: OwnShipHistory[];

  // Truth Data
  contacts: Contact[];

  // Sensor Data
  sensorReadings: SensorReading[];

  // Tracker Data
  trackers: Tracker[];
  selectedTrackerId: string | null;
  tickCount: number;
  gameTime: number; // in seconds
  timeScale: TimeScale;
  activeStation: Station;

  // Ordered Data (Controls)
  orderedHeading: number;
  orderedSpeed: number;
  orderedDepth: number;

  // Actions
  setOrderedHeading: (heading: number) => void;
  setOrderedSpeed: (speed: number) => void;
  setOrderedDepth: (depth: number) => void;
  designateTracker: (bearing: number) => void;
  setSelectedTracker: (id: string | null) => void;
  updateTrackerSolution: (trackerId: string, solution: Partial<TrackerSolution>) => void;
  setTimeScale: (scale: TimeScale) => void;
  setActiveStation: (station: Station) => void;
  tick: () => void;
}

// Helper to normalize angle to 0-359
const normalizeAngle = (angle: number) => {
  return (angle + 360) % 360;
};

// Physics constants
const TURN_RATE = 0.5; // degrees per tick
const ACCELERATION = 0.05; // knots per tick
const DECELERATION = 0.05; // knots per tick
const DIVE_RATE = 1.0; // feet per tick
const ASCENT_RATE = 1.0; // feet per tick
const FEET_PER_KNOT_PER_TICK = 0.028; // approx 1.68 ft/sec / 60 ticks/sec
const MAX_HISTORY = 300;

// Helper for Gaussian noise (Box-Muller)
const gaussianRandom = (mean: number, stdev: number) => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return num * stdev + mean;
};

export const useSubmarineStore = create<SubmarineState>((set) => ({
  heading: 0,
  speed: 0,
  depth: 0,
  x: 0,
  y: 0,
  ownShipHistory: [],
  contacts: [{ id: 'Sierra-1', x: 5000, y: 5000 }],
  sensorReadings: [],
  trackers: [],
  selectedTrackerId: null,
  tickCount: 0,
  gameTime: 0,
  timeScale: 'FAST',
  activeStation: 'TMA',
  orderedHeading: 0,
  orderedSpeed: 0,
  orderedDepth: 0,

  setOrderedHeading: (heading) => set({ orderedHeading: normalizeAngle(heading) }),
  setOrderedSpeed: (speed) => set({ orderedSpeed: Math.max(0, Math.min(30, speed)) }),
  setOrderedDepth: (depth) => set({ orderedDepth: Math.max(0, Math.min(1200, depth)) }),

  designateTracker: (bearing) => set((state) => {
    const id = `S${state.trackers.length + 1}`;

    // Find closest sensor reading
    let bestContactId: string | undefined;
    let minDiff = 360;

    state.sensorReadings.forEach(reading => {
      let diff = Math.abs(reading.bearing - bearing);
      if (diff > 180) diff = 360 - diff; // Handle wrap
      if (diff < minDiff) {
        minDiff = diff;
        bestContactId = reading.contactId;
      }
    });

    // Threshold e.g. 5 degrees
    if (minDiff > 5) {
      bestContactId = undefined;
    }

    const newTracker: Tracker = {
      id,
      contactId: bestContactId,
      currentBearing: bearing,
      bearingHistory: [],
      solution: {
        speed: 10,
        range: 10000,
        course: 0,
        bearing: normalizeAngle(bearing + state.heading),
        anchorTime: state.gameTime,
        anchorOwnShip: { x: state.x, y: state.y, heading: state.heading }
      }
    };
    return {
      trackers: [...state.trackers, newTracker],
      selectedTrackerId: id // Auto-select new tracker
    };
  }),

  setSelectedTracker: (id) => set({ selectedTrackerId: id }),

  updateTrackerSolution: (trackerId, solution) => set((state) => ({
    trackers: state.trackers.map(t =>
      t.id === trackerId
        ? { ...t, solution: { ...t.solution, ...solution } }
        : t
    )
  })),

  setTimeScale: (scale) => set({ timeScale: scale }),
  setActiveStation: (station) => set({ activeStation: station }),

  tick: () =>
    set((state) => {
      let newHeading = state.heading;
      let newSpeed = state.speed;
      let newDepth = state.depth;

      // Update Heading
      if (state.heading !== state.orderedHeading) {
        const diff = state.orderedHeading - state.heading;
        let delta = diff;

        // Handle wrapping for shortest turn
        if (diff > 180) delta = diff - 360;
        if (diff < -180) delta = diff + 360;

        if (Math.abs(delta) < TURN_RATE) {
          newHeading = state.orderedHeading;
        } else {
          newHeading += Math.sign(delta) * TURN_RATE;
        }
        newHeading = normalizeAngle(newHeading);
      }

      // Update Speed
      if (state.speed !== state.orderedSpeed) {
        const diff = state.orderedSpeed - state.speed;
        const rate = diff > 0 ? ACCELERATION : DECELERATION;
        if (Math.abs(diff) < rate) {
          newSpeed = state.orderedSpeed;
        } else {
          newSpeed += Math.sign(diff) * rate;
        }
      }

      // Update Depth
      if (state.depth !== state.orderedDepth) {
        const diff = state.orderedDepth - state.depth;
        const rate = diff > 0 ? DIVE_RATE : ASCENT_RATE;
        if (Math.abs(diff) < rate) {
          newDepth = state.orderedDepth;
        } else {
          newDepth += Math.sign(diff) * rate;
        }
      }

      // Update Position (Simple 2D kinematics)
      // Nav convention: 0 is North (Positive Y?), 90 is East (Positive X?)
      // Let's assume standard math convention for X/Y, but mapping Heading to it.
      // If Heading 0 is North (Up, +Y) and 90 is East (Right, +X):
      // dx = speed * sin(heading)
      // dy = speed * cos(heading)
      const radHeading = (newHeading * Math.PI) / 180;
      const distance = newSpeed * FEET_PER_KNOT_PER_TICK;
      const newX = state.x + distance * Math.sin(radHeading);
      const newY = state.y + distance * Math.cos(radHeading);

      // Sensor Simulation
      const newSensorReadings = state.contacts.reduce((acc, contact) => {
        // Calculate True Bearing
        const dx = contact.x - newX;
        const dy = contact.y - newY;

        // Atan2 returns angle from +X axis (East).
        // If 0 is North (+Y), 90 is East (+X).
        // Math angle = atan2(dy, dx).
        // Nav bearing = (90 - MathAngle + 360) % 360.
        // Wait, if 0 is North (+Y), then (1,1) is 45 deg. atan2(1,1)=45. 90-45=45. Correct.
        // (1,0) is East (90). atan2(0,1)=0. 90-0=90. Correct.
        // (0,1) is North (0). atan2(1,0)=90. 90-90=0. Correct.
        // (-1, 0) is West (270). atan2(0, -1)=180. 90-180=-90 -> 270. Correct.
        // (0, -1) is South (180). atan2(-1, 0)=-90. 90-(-90)=180. Correct.

        const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        const trueBearing = normalizeAngle(90 - mathAngleDeg);

        const relativeBearing = normalizeAngle(trueBearing - newHeading);

        // Baffles: Blind in rear 60 degrees (150 to 210 relative)
        if (relativeBearing > 150 && relativeBearing < 210) {
          return acc;
        }

        // Add Noise (e.g. 2 degrees std dev)
        const noisyBearing = normalizeAngle(gaussianRandom(relativeBearing, 1.0));

        acc.push({
          contactId: contact.id,
          bearing: noisyBearing
        });

        return acc;
      }, [] as SensorReading[]);

      // Update Trackers
      const newTickCount = state.tickCount + 1;
      const newGameTime = state.gameTime + (1/60);
      let newTrackers = state.trackers.map(tracker => {
        // Follow contact if locked
        if (tracker.contactId) {
          const reading = newSensorReadings.find(r => r.contactId === tracker.contactId);
          if (reading) {
             return { ...tracker, currentBearing: reading.bearing };
          }
        }
        return tracker;
      });

      // Every 60 ticks (approx 1 sec), record history
      let newOwnShipHistory = state.ownShipHistory;
      if (newTickCount % 60 === 0) {
        newTrackers = newTrackers.map(tracker => {
          let newHistory = [
            ...tracker.bearingHistory,
            { time: newGameTime, bearing: tracker.currentBearing }
          ];
          if (newHistory.length > MAX_HISTORY) {
            newHistory = newHistory.slice(newHistory.length - MAX_HISTORY);
          }
          return {
            ...tracker,
            bearingHistory: newHistory
          };
        });

        newOwnShipHistory = [
          ...state.ownShipHistory,
          { time: newGameTime, x: newX, y: newY, heading: newHeading }
        ];
        if (newOwnShipHistory.length > MAX_HISTORY) {
          newOwnShipHistory = newOwnShipHistory.slice(newOwnShipHistory.length - MAX_HISTORY);
        }
      }

      return {
        heading: newHeading,
        speed: newSpeed,
        depth: newDepth,
        x: newX,
        y: newY,
        ownShipHistory: newOwnShipHistory,
        sensorReadings: newSensorReadings,
        tickCount: newTickCount,
        gameTime: newGameTime,
        trackers: newTrackers
      };
    }),
}));
