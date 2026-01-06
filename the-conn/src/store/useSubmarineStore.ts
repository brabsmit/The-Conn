import { create } from 'zustand';

interface Contact {
  id: string;
  x: number;
  y: number;
  heading?: number;
  speed?: number;
  type?: 'ENEMY' | 'NEUTRAL';
  classification?: 'MERCHANT' | 'ESCORT' | 'SUB' | 'BIOLOGICAL';
  sourceLevel?: number;
  cavitationSpeed?: number;
  aiMode?: 'IDLE' | 'ATTACK' | 'EVADE';
  aiLastUpdate?: number;
  sensitivity?: number;
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

export type Station = 'TMA' | 'WCS' | 'NAV';

export type ViewScale = 'FAST' | 'MED' | 'SLOW';

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
  classificationStatus: 'PENDING' | 'CLASSIFIED';
  timeToClassify: number;
  classification?: string;
}

export type TubeStatus = 'EMPTY' | 'LOADING' | 'DRY' | 'FLOODING' | 'WET' | 'EQUALIZING' | 'EQUALIZED' | 'OPENING' | 'OPEN' | 'FIRING';

export interface WeaponData {
  runDepth: number;
  floor: number;
  ceiling: number;
  searchMode: 'ACTIVE' | 'PASSIVE';
}

export interface Tube {
  id: number;
  status: TubeStatus;
  progress: number;
  weaponData: WeaponData | null;
  torpedoId?: string;
}

export interface Torpedo {
  id: string;
  position: { x: number; y: number };
  heading: number;
  targetHeading: number;
  speed: number;
  status: 'RUNNING' | 'DUD' | 'EXPLODED';
  launchTime: number;
  // Guidance Params
  designatedTargetId?: string; // Target assigned at launch (hint)
  activeTargetId?: string; // Target actually locked on
  enableRange: number; // Distance at which to start searching
  gyroAngle: number; // Initial heading
  distanceTraveled: number;
}

interface Transient {
  type: string;
  startTime: number;
  duration: number;
  magnitude: number;
}

interface SubmarineState {
  // OwnShip Data
  heading: number; // 0-359
  speed: number; // 0-30kts
  depth: number; // 0-1200ft
  x: number;
  y: number;
  ownShipHistory: OwnShipHistory[];
  ownshipNoiseLevel: number;
  cavitating: boolean;
  transients: Transient[];

  // Truth Data
  contacts: Contact[];

  // Sensor Data
  sensorReadings: SensorReading[];
  logs: string[];

  // Tracker Data
  trackers: Tracker[];
  selectedTrackerId: string | null;
  tubes: Tube[];
  torpedoes: Torpedo[];
  tickCount: number;
  gameTime: number; // in seconds
  viewScale: ViewScale;
  activeStation: Station;

  // Ordered Data (Controls)
  orderedHeading: number;
  orderedSpeed: number;
  orderedDepth: number;

  // Actions
  setOrderedHeading: (heading: number) => void;
  setOrderedSpeed: (speed: number) => void;
  setOrderedDepth: (depth: number) => void;
  addLog: (message: string) => void;
  designateTracker: (bearing: number) => void;
  setSelectedTracker: (id: string | null) => void;
  deleteTracker: (id: string) => void;
  updateTrackerSolution: (trackerId: string, solution: Partial<TrackerSolution>) => void;
  setViewScale: (scale: ViewScale) => void;
  setActiveStation: (station: Station) => void;
  loadTube: (tubeId: number, weaponData: WeaponData) => void;
  floodTube: (tubeId: number) => void;
  equalizeTube: (tubeId: number) => void;
  openTube: (tubeId: number) => void;
  fireTube: (tubeId: number, designatedTargetId?: string, enableRange?: number, gyroAngle?: number) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  removeContact: (id: string) => void;
  loadScenario: (state: Partial<SubmarineState>) => void;
  tick: (delta?: number) => void;
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
  ownshipNoiseLevel: 0.1,
  cavitating: false,
  transients: [],
  contacts: [{
    id: 'Sierra-1',
    x: 5000,
    y: 5000,
    type: 'ENEMY',
    classification: 'MERCHANT',
    sourceLevel: 1.0,
    cavitationSpeed: 10
  }],
  sensorReadings: [],
  logs: [],
  trackers: [],
  selectedTrackerId: null,
  tubes: Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    status: 'EMPTY',
    progress: 0,
    weaponData: null
  })),
  torpedoes: [],
  tickCount: 0,
  gameTime: 0,
  viewScale: 'FAST',
  activeStation: 'TMA',
  orderedHeading: 0,
  orderedSpeed: 0,
  orderedDepth: 0,

  setOrderedHeading: (heading) => set({ orderedHeading: normalizeAngle(heading) }),
  setOrderedSpeed: (speed) => set({ orderedSpeed: Math.max(0, Math.min(30, speed)) }),
  setOrderedDepth: (depth) => set({ orderedDepth: Math.max(0, Math.min(1200, depth)) }),

  addLog: (message) => set((state) => ({ logs: [...state.logs, message].slice(-50) })),

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
      },
      classificationStatus: 'PENDING',
      timeToClassify: 15
    };
    return {
      trackers: [...state.trackers, newTracker],
      selectedTrackerId: id // Auto-select new tracker
    };
  }),

  setSelectedTracker: (id) => set({ selectedTrackerId: id }),

  deleteTracker: (id) => set((state) => ({
    trackers: state.trackers.filter(t => t.id !== id),
    selectedTrackerId: state.selectedTrackerId === id ? null : state.selectedTrackerId
  })),

  updateTrackerSolution: (trackerId, solution) => set((state) => ({
    trackers: state.trackers.map(t =>
      t.id === trackerId
        ? { ...t, solution: { ...t.solution, ...solution } }
        : t
    )
  })),

  setViewScale: (scale) => set({ viewScale: scale }),
  setActiveStation: (station) => set({ activeStation: station }),

  loadTube: (tubeId, weaponData) => set((state) => ({
    tubes: state.tubes.map(t =>
      t.id === tubeId && t.status === 'EMPTY'
        ? { ...t, status: 'LOADING', progress: 0, weaponData, torpedoId: undefined }
        : t
    )
  })),

  floodTube: (tubeId) => set((state) => ({
    tubes: state.tubes.map(t =>
      t.id === tubeId && t.status === 'DRY'
        ? { ...t, status: 'FLOODING', progress: 0 }
        : t
    ),
    transients: [...state.transients, { type: 'TUBE_FLOOD', startTime: state.gameTime, duration: 10, magnitude: 0.2 }]
  })),

  equalizeTube: (tubeId) => set((state) => ({
    tubes: state.tubes.map(t =>
      t.id === tubeId && t.status === 'WET'
        ? { ...t, status: 'EQUALIZING', progress: 0 }
        : t
    )
  })),

  openTube: (tubeId) => set((state) => ({
    tubes: state.tubes.map(t =>
      t.id === tubeId && t.status === 'EQUALIZED'
        ? { ...t, status: 'OPENING', progress: 0 }
        : t
    ),
    transients: [...state.transients, { type: 'MUZZLE_OPEN', startTime: state.gameTime, duration: 10, magnitude: 0.3 }]
  })),

  addContact: (contact) => set((state) => ({
    contacts: [...state.contacts, contact]
  })),

  updateContact: (id, updates) => set((state) => ({
    contacts: state.contacts.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  removeContact: (id) => set((state) => ({
    contacts: state.contacts.filter(c => c.id !== id)
  })),

  loadScenario: (newState) => set((state) => ({
    ...state,
    ...newState,
    // Ensure deep merge or reset of complex objects if needed, but simple replacement works for now
    // Reset history if not provided
    ownShipHistory: newState.ownShipHistory || [],
    trackers: newState.trackers || [],
    contacts: newState.contacts || [],
    torpedoes: newState.torpedoes || [],
    transients: newState.transients || [],
    sensorReadings: newState.sensorReadings || [],
    tickCount: 0,
    gameTime: 0
  })),

  fireTube: (tubeId, designatedTargetId, enableRange, gyroAngle) => set((state) => {
    const tube = state.tubes.find(t => t.id === tubeId);
    if (!tube || tube.status !== 'OPEN' || !tube.weaponData) {
      return {};
    }

    const torpedoId = `T-${Date.now()}-${tube.id}`;

    // Defaults if not provided
    const launchHeading = gyroAngle !== undefined ? gyroAngle : state.heading;
    const launchEnableRange = enableRange !== undefined ? enableRange : 1000;

    const newTorpedo: Torpedo = {
      id: torpedoId,
      position: { x: state.x, y: state.y },
      heading: launchHeading,
      targetHeading: launchHeading, // Used for pure straight run if not homing
      speed: 20, // Launch speed
      status: 'RUNNING',
      launchTime: state.gameTime,
      designatedTargetId,
      activeTargetId: undefined, // Not locked initially
      enableRange: launchEnableRange,
      gyroAngle: launchHeading,
      distanceTraveled: 0
    };

    return {
      tubes: state.tubes.map(t =>
        t.id === tubeId
          ? { ...t, status: 'FIRING', progress: 0, torpedoId }
          : t
      ),
      torpedoes: [...state.torpedoes, newTorpedo],
      transients: [...state.transients, { type: 'LAUNCH', startTime: state.gameTime, duration: 5, magnitude: 1.0 }]
    };
  }),

  tick: (delta = 1) =>
    set((state) => {
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
      // Nav convention: 0 is North (Positive Y?), 90 is East (Positive X?)
      // Let's assume standard math convention for X/Y, but mapping Heading to it.
      // If Heading 0 is North (Up, +Y) and 90 is East (Right, +X):
      // dx = speed * sin(heading)
      // dy = speed * cos(heading)
      const radHeading = (newHeading * Math.PI) / 180;
      const distance = newSpeed * FEET_PER_KNOT_PER_TICK * delta;
      const newX = state.x + distance * Math.sin(radHeading);
      const newY = state.y + distance * Math.cos(radHeading);

      // --- Noise Calculation ---
      // Base Noise
      const baseNoise = 0.1;

      // Flow Noise (Linear with speed)
      // Assuming Max Speed ~30kts = 0.4 noise addition
      const flowNoise = (newSpeed / 30.0) * 0.4;

      // Cavitation (Threshold)
      const cavitationThreshold = 12.0;
      const isCavitating = newSpeed > cavitationThreshold;
      const cavitationNoise = isCavitating ? 0.5 : 0;

      // Transients
      const activeTransients = state.transients.filter(t => (state.gameTime - t.startTime) < t.duration);
      const transientNoise = activeTransients.reduce((sum, t) => sum + t.magnitude, 0);

      const totalNoise = baseNoise + flowNoise + cavitationNoise + transientNoise;

      // Update Contacts (Truth movement & AI)
      const newContactsInitial = state.contacts.map(contact => {
        let currentContact = { ...contact };

        // AI Logic (Only for ENEMY)
        if (currentContact.type === 'ENEMY') {
            const timeSinceLastUpdate = state.gameTime - (currentContact.aiLastUpdate || 0);

            // Run AI every 1 second
            if (timeSinceLastUpdate >= 1.0) {
                currentContact.aiLastUpdate = state.gameTime;

                // 1. Detection
                const dx = state.x - currentContact.x;
                const dy = state.y - currentContact.y;
                const distSquared = (dx * dx + dy * dy);

                // Sensitivity heuristic:
                // OwnshipNoise ~ 0.1 to 1.0. Dist ~ 8000yds -> DistSq ~ 64,000,000.
                // Ratio ~ 1.5e-9.
                // Sensitivity ~ 1e8 to get alertLevel ~ 0.15.
                // If Alert > 0.5 triggers Attack.
                // Let's default sensitivity to 300,000,000.
                const sensitivity = currentContact.sensitivity || 300000000;
                const alertLevel = (totalNoise / Math.max(1, distSquared)) * sensitivity;

                // 2. Triggers
                // Trigger Attack?
                if (alertLevel > 0.5) {
                    currentContact.aiMode = 'ATTACK';
                }

                // Trigger Evade? (Torpedo Launch Transient)
                const launchTransient = state.transients.find(t => t.type === 'LAUNCH' && (state.gameTime - t.startTime) < 5);
                if (launchTransient) {
                    currentContact.aiMode = 'EVADE';
                }

                // 3. Behavior
                if (currentContact.aiMode === 'EVADE') {
                    // Sprint
                    currentContact.speed = 25;

                    // Turn Away (Reciprocal Bearing)
                    // Angle from Enemy to Ownship
                    const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);
                    // Bearing is 90 - angle (Nav convention)
                    const bearingToOwnship = normalizeAngle(90 - angleToOwnship);
                    // Turn away (+180)
                    currentContact.heading = normalizeAngle(bearingToOwnship + 180);
                }
            }
        }

        if (currentContact.speed !== undefined && currentContact.heading !== undefined) {
            const radHeading = (currentContact.heading * Math.PI) / 180;
            const distance = currentContact.speed * FEET_PER_KNOT_PER_TICK * delta;
            return {
                ...currentContact,
                x: currentContact.x + distance * Math.sin(radHeading),
                y: currentContact.y + distance * Math.cos(radHeading)
            };
        }
        return currentContact;
      });

      // Update Torpedoes
      const newTorpedoes = state.torpedoes.map(torpedo => {
        if (torpedo.status !== 'RUNNING') return torpedo;

        let newSpeed = torpedo.speed;
        if (newSpeed < 45) {
          newSpeed += 0.5 * delta; // Accelerate
          if (newSpeed > 45) newSpeed = 45;
        }

        const distThisTick = newSpeed * FEET_PER_KNOT_PER_TICK * delta; // Feet
        const newTotalDistance = torpedo.distanceTraveled + (distThisTick / 3); // Yards

        let newHeading = torpedo.heading;

        // --- Autonomy Logic ---

        let finalStatus: Torpedo['status'] = torpedo.status;
        let finalActiveTargetId = torpedo.activeTargetId;

        // Lifecycle: Fuel Exhaustion
        if (newTotalDistance > 20000) {
            finalStatus = 'DUD';
        }

        // Phase 2: Enable / Snake Search
        if (newTotalDistance >= torpedo.enableRange && finalStatus === 'RUNNING') {
           // Acquisition Logic (Active Seeker)
           if (!finalActiveTargetId) {
                let bestContactId = undefined;
                let minDist = 2000; // Seeker Range

                // Prioritize designated target
                if (torpedo.designatedTargetId) {
                    const contact = state.contacts.find(c => c.id === torpedo.designatedTargetId);
                    if (contact) {
                         const dx = contact.x - torpedo.position.x;
                         const dy = contact.y - torpedo.position.y;
                         const distToContact = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                         if (distToContact < 2000) {
                            const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                            const bearingToContact = normalizeAngle(90 - mathAngle);
                            let relBearing = Math.abs(bearingToContact - newHeading);
                            if (relBearing > 180) relBearing = 360 - relBearing;

                            if (relBearing < 45) {
                                bestContactId = contact.id;
                            }
                         }
                    }
                }

                // If not found designated, check all contacts
                if (!bestContactId) {
                    for (const contact of state.contacts) {
                        const dx = contact.x - torpedo.position.x;
                        const dy = contact.y - torpedo.position.y;
                        const distToContact = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                        if (distToContact < 2000) {
                            const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                            const bearingToContact = normalizeAngle(90 - mathAngle);
                            let relBearing = Math.abs(bearingToContact - newHeading);
                            if (relBearing > 180) relBearing = 360 - relBearing;

                            if (relBearing < 45) {
                                if (distToContact < minDist) {
                                    minDist = distToContact;
                                    bestContactId = contact.id;
                                }
                            }
                        }
                    }
                }

                if (bestContactId) {
                    finalActiveTargetId = bestContactId;
                }
           }

           // Snake Search Pattern (if not locked)
           if (!finalActiveTargetId) {
               const searchWidth = 20; // degrees
               const searchPeriod = 2000; // yards
               const phase = ((newTotalDistance - torpedo.enableRange) % searchPeriod) / searchPeriod;
               const offset = Math.sin(phase * Math.PI * 2) * searchWidth;
               newHeading = normalizeAngle(torpedo.gyroAngle + offset);
           }
        }
        // Phase 1: Transit (Implicit - stay on gyroAngle if < enableRange)
        else {
            newHeading = torpedo.gyroAngle;
        }

        // Phase 3: Homing (Pure Pursuit)
        if (finalActiveTargetId && finalStatus === 'RUNNING') {
             const contact = state.contacts.find(c => c.id === finalActiveTargetId);
             if (contact) {
                 const dx = contact.x - torpedo.position.x;
                 const dy = contact.y - torpedo.position.y;
                 const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                 const bearingToContact = normalizeAngle(90 - mathAngle);
                 newHeading = bearingToContact;

                 // Proximity Fuse (Detonation)
                 const distToContact = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                 if (distToContact < 50) {
                     finalStatus = 'EXPLODED';
                 }
             } else {
                 finalActiveTargetId = undefined; // Lost lock
             }
        }

        // Apply Heading
        const torpRadHeading = (newHeading * Math.PI) / 180;
        const torpNewX = torpedo.position.x + distThisTick * Math.sin(torpRadHeading);
        const torpNewY = torpedo.position.y + distThisTick * Math.cos(torpRadHeading);

        return {
          ...torpedo,
          speed: newSpeed,
          heading: newHeading,
          position: { x: torpNewX, y: torpNewY },
          distanceTraveled: newTotalDistance,
          status: finalStatus,
          activeTargetId: finalActiveTargetId
        };
      });

      // Handle Detonation Effects (Remove Targets)
      let newContacts = newContactsInitial;
      newTorpedoes.forEach(t => {
          if (t.status === 'EXPLODED' && t.activeTargetId) {
              newContacts = newContacts.filter(c => c.id !== t.activeTargetId);
          }
      });

      // Filter out dead torpedoes
      const activeTorpedoes = newTorpedoes.filter(t => t.status !== 'DUD' && t.status !== 'EXPLODED');

      // Sensor Simulation
      const newSensorReadings = newContacts.reduce((acc, contact) => {
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
      let newLogs = state.logs;

      let newTrackers = state.trackers.map(tracker => {
        let updatedTracker = { ...tracker };

        // Follow contact if locked
        if (updatedTracker.contactId) {
          const reading = newSensorReadings.find(r => r.contactId === updatedTracker.contactId);
          if (reading) {
             updatedTracker.currentBearing = reading.bearing;
          }
        }

        // Classification Logic
        if (updatedTracker.classificationStatus === 'PENDING') {
            updatedTracker.timeToClassify -= (1/60) * delta;
            if (updatedTracker.timeToClassify <= 0) {
                updatedTracker.classificationStatus = 'CLASSIFIED';

                // Reveal Truth
                const contact = state.contacts.find(c => c.id === updatedTracker.contactId);
                const type = contact?.classification || 'UNKNOWN';
                updatedTracker.classification = type;

                // Log
                newLogs = [...newLogs, `Conn, Sonar: Contact ${updatedTracker.id} classified as ${type}.`].slice(-50);
            }
        }

        return updatedTracker;
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

      // Update Tubes (Progress)
      const newTubes = state.tubes.map(tube => {
        if (['LOADING', 'FLOODING', 'EQUALIZING', 'OPENING', 'FIRING'].includes(tube.status)) {
          const newProgress = tube.progress + 1;
          if (newProgress >= 100) {
            // Transition
            switch (tube.status) {
              case 'LOADING': return { ...tube, status: 'DRY' as TubeStatus, progress: 0 };
              case 'FLOODING': return { ...tube, status: 'WET' as TubeStatus, progress: 0 };
              case 'EQUALIZING': return { ...tube, status: 'EQUALIZED' as TubeStatus, progress: 0 };
              case 'OPENING': return { ...tube, status: 'OPEN' as TubeStatus, progress: 0 };
              case 'FIRING': return { ...tube, status: 'EMPTY' as TubeStatus, progress: 0, weaponData: null };
              default: return tube;
            }
          } else {
            return { ...tube, progress: newProgress };
          }
        }
        return tube;
      });

      return {
        heading: newHeading,
        speed: newSpeed,
        depth: newDepth,
        x: newX,
        y: newY,
        ownShipHistory: newOwnShipHistory,
        contacts: newContacts, // Update truth data
        sensorReadings: newSensorReadings,
        logs: newLogs,
        tickCount: newTickCount,
        gameTime: newGameTime,
        trackers: newTrackers,
        tubes: newTubes,
        torpedoes: activeTorpedoes,
        ownshipNoiseLevel: totalNoise,
        cavitating: isCavitating,
        transients: activeTransients
      };
    }),
}));
