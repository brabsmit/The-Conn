import { create } from 'zustand';

interface Contact {
  id: string;
  x: number;
  y: number;
  heading?: number;
  speed?: number;
  type?: 'ENEMY' | 'NEUTRAL';
  classification?: 'MERCHANT' | 'ESCORT' | 'SUB' | 'BIOLOGICAL';
  depth?: number;
  sourceLevel?: number;
  cavitationSpeed?: number;
  aiMode?: 'IDLE' | 'PATROL' | 'APPROACH' | 'ATTACK' | 'EVADE';
  aiLastUpdate?: number;
  aiReactionTimer?: number;
  torpedoCooldown?: number;
  canDetectTorpedoes?: boolean;
  sensitivity?: number;
  status?: 'ACTIVE' | 'DESTROYED';
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
  computedWorldX: number;
  computedWorldY: number;
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
  autoSequence?: boolean;
}

export interface Torpedo {
  id: string;
  position: { x: number; y: number };
  heading: number;
  targetHeading: number;
  speed: number;
  status: 'RUNNING' | 'DUD' | 'EXPLODED';
  launchTime: number;
  searchMode: 'ACTIVE' | 'PASSIVE';
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

export interface VisualTransient {
  bearing: number;
  intensity: number;
  timestamp: number;
}

interface ScriptedEvent {
  time: number;
  type: 'LOG' | 'DELETE_TRACKER' | 'RESET_ALERT';
  payload: any;
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
  visualTransients: VisualTransient[];
  scriptedEvents: ScriptedEvent[];

  // Truth Data
  contacts: Contact[];

  // Sensor Data
  sensorReadings: SensorReading[];
  logs: { message: string; timestamp: number; type?: 'INFO' | 'ALERT' }[];
  alertLevel: 'NORMAL' | 'COMBAT';

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
  addLog: (message: string, type?: 'INFO' | 'ALERT') => void;
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
const MAX_HISTORY = 25000;

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
  visualTransients: [],
  scriptedEvents: [],
  contacts: [{
    id: 'Sierra-1',
    x: 5000,
    y: 5000,
    type: 'ENEMY',
    classification: 'MERCHANT',
    depth: 50,
    sourceLevel: 1.0,
    cavitationSpeed: 10,
    status: 'ACTIVE'
  }],
  sensorReadings: [],
  logs: [],
  alertLevel: 'NORMAL',
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
  orderedSpeed: 10,
  orderedDepth: 150,

  setOrderedHeading: (heading) => set({ orderedHeading: normalizeAngle(heading) }),
  setOrderedSpeed: (speed) => set({ orderedSpeed: Math.max(0, Math.min(30, speed)) }),
  setOrderedDepth: (depth) => set({ orderedDepth: Math.max(0, Math.min(1200, depth)) }),

  addLog: (message, type = 'INFO') => set((state) => ({ logs: [...state.logs, { message, timestamp: state.gameTime, type }].slice(-50) })),

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
        anchorOwnShip: { x: state.x, y: state.y, heading: state.heading },
        computedWorldX: state.x + 30000 * Math.sin(normalizeAngle(bearing + state.heading) * Math.PI / 180), // 10k yds * 3
        computedWorldY: state.y + 30000 * Math.cos(normalizeAngle(bearing + state.heading) * Math.PI / 180)
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

  updateTrackerSolution: (trackerId, solutionUpdates) => set((state) => ({
    trackers: state.trackers.map(t => {
      if (t.id !== trackerId) return t;

      const mergedSolution = { ...t.solution, ...solutionUpdates };

      // Re-calculate anchor position based on current ownship and new solution parameters
      const bearingRad = (mergedSolution.bearing * Math.PI) / 180;
      const rangeFt = mergedSolution.range * 3;

      const relX = rangeFt * Math.sin(bearingRad);
      const relY = rangeFt * Math.cos(bearingRad);

      return {
        ...t,
        solution: {
          ...mergedSolution,
          anchorTime: state.gameTime,
          anchorOwnShip: { x: state.x, y: state.y, heading: state.heading },
          computedWorldX: state.x + relX,
          computedWorldY: state.y + relY
        }
      };
    })
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
    contacts: [...state.contacts, { ...contact, status: contact.status || 'ACTIVE' }]
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
    gameTime: 0,
    alertLevel: 'NORMAL',
    scriptedEvents: [],
    visualTransients: []
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
      searchMode: tube.weaponData?.searchMode || 'PASSIVE',
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
      const radHeading = (newHeading * Math.PI) / 180;
      const distance = newSpeed * FEET_PER_KNOT_PER_TICK * delta;
      const newX = state.x + distance * Math.sin(radHeading);
      const newY = state.y + distance * Math.cos(radHeading);

      // --- Noise Calculation ---
      const baseNoise = 0.1;
      const flowNoise = (newSpeed / 30.0) * 0.4;
      const cavitationThreshold = 12.0;
      const isCavitating = newSpeed > cavitationThreshold;
      const cavitationNoise = isCavitating ? 0.5 : 0;
      const activeTransients = state.transients.filter(t => (state.gameTime - t.startTime) < t.duration);
      const transientNoise = activeTransients.reduce((sum, t) => sum + t.magnitude, 0);
      const totalNoise = baseNoise + flowNoise + cavitationNoise + transientNoise;

      // Update Contacts (Truth movement & AI)
      let newContacts = state.contacts.map(contact => {
        // Skip destroyed contacts movement logic
        if (contact.status === 'DESTROYED') return contact;

        let currentContact = { ...contact };

        // AI Logic (Only for ENEMY)
        if (currentContact.type === 'ENEMY') {
            const timeSinceLastUpdate = state.gameTime - (currentContact.aiLastUpdate || 0);

            // Run AI every 1 second
            if (timeSinceLastUpdate >= 1.0) {
                currentContact.aiLastUpdate = state.gameTime;

                // Merchant: Return immediately (No reaction)
                if (currentContact.classification === 'MERCHANT') {
                    // Force maintain IDLE or existing state without processing threats/ownship
                    return currentContact;
                }

                // 1. Detection (Ownship)
                const dx = state.x - currentContact.x;
                const dy = state.y - currentContact.y;
                const distSquared = (dx * dx + dy * dy);
                const sensitivity = currentContact.sensitivity !== undefined ? currentContact.sensitivity : 300000000;
                const signalStrength = (totalNoise / Math.max(1, distSquared)) * sensitivity;
                const detectionThreshold = 0.5;
                const signalExcess = signalStrength - detectionThreshold;

                // 2. State Machine Logic
                if (!currentContact.aiMode) currentContact.aiMode = 'PATROL';

                if (currentContact.torpedoCooldown && currentContact.torpedoCooldown > 0) {
                    currentContact.torpedoCooldown -= 1;
                }

                // A. PATROL State
                if (currentContact.aiMode === 'PATROL' || currentContact.aiMode === 'IDLE') {
                    if (signalExcess > 0) {
                        currentContact.aiMode = 'APPROACH';
                    }
                }

                // B. APPROACH State ("The Stalk")
                if (currentContact.aiMode === 'APPROACH') {
                     // Lost contact logic with hysteresis
                     if (signalExcess < -0.2) {
                         currentContact.aiMode = 'PATROL';
                     } else {
                         // Intelligent Maneuvering
                         const distYards = Math.sqrt(distSquared) / 3;

                         // Calculate bearing to Ownship
                         const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);

                         // Lead Intercept Logic
                         // Predict Ownship position in 5 minutes (300 seconds)
                         const leadTime = 300;
                         const predictedOx = state.x + (Math.sin(state.heading * Math.PI/180) * state.speed * FEET_PER_KNOT_PER_TICK * 60 * (leadTime/60));
                         const predictedOy = state.y + (Math.cos(state.heading * Math.PI/180) * state.speed * FEET_PER_KNOT_PER_TICK * 60 * (leadTime/60));

                         const pdx = predictedOx - currentContact.x;
                         const pdy = predictedOy - currentContact.y;
                         const pAngle = Math.atan2(pdy, pdx) * (180 / Math.PI);
                         const interceptHeading = normalizeAngle(90 - pAngle);

                         currentContact.heading = interceptHeading;
                         currentContact.speed = 5; // Silent Speed

                         // Transition to ATTACK
                         if (distYards < 4000) {
                             if (!currentContact.torpedoCooldown || currentContact.torpedoCooldown <= 0) {
                                 currentContact.aiMode = 'ATTACK';
                             }
                         }
                     }
                }

                // C. ATTACK State ("The Ambush")
                if (currentContact.aiMode === 'ATTACK') {
                    if (!currentContact.torpedoCooldown || currentContact.torpedoCooldown <= 0) {
                        currentContact.torpedoCooldown = 600; // Cooldown
                        currentContact.aiMode = 'EVADE'; // Fire and Evade
                    }
                }

                // 3. Threat Perception (Torpedoes)
                let detectedThreatType: 'NONE' | 'PASSIVE' | 'ACTIVE' = 'NONE';
                let detectedInBaffles = false;

                // Check capability (Merchant defaults to false/oblivious if set, or check type)
                const canDetect = currentContact.canDetectTorpedoes !== undefined ? currentContact.canDetectTorpedoes : true;

                if (canDetect) {
                     for (const torpedo of state.torpedoes) {
                         if (torpedo.status !== 'RUNNING') continue;
                         const tDx = torpedo.position.x - currentContact.x;
                         const tDy = torpedo.position.y - currentContact.y;
                         const distToTorp = Math.sqrt(tDx*tDx + tDy*tDy) / 3; // yards

                         // Calculate Bearing Info
                         const angleToTorp = Math.atan2(tDy, tDx) * (180 / Math.PI);
                         const bearingToTorp = normalizeAngle(90 - angleToTorp);
                         let relBrg = Math.abs((currentContact.heading || 0) - bearingToTorp);
                         if (relBrg > 180) relBrg = 360 - relBrg;
                         const inBaffles = relBrg > 150;

                         // Active Intercept (Ping)
                         const isPinging = torpedo.distanceTraveled >= torpedo.enableRange && torpedo.searchMode === 'ACTIVE';
                         if (isPinging && distToTorp < 4000) {
                              detectedThreatType = 'ACTIVE';
                              detectedInBaffles = inBaffles;
                              break; // Priority
                         }

                         // Passive Detection
                         const detectionRange = inBaffles ? 1000 : 3000;
                         if (distToTorp < detectionRange) {
                              detectedThreatType = 'PASSIVE';
                              detectedInBaffles = inBaffles;
                              // Don't break, check for active
                         }
                     }
                }

                // 4. Reaction Logic
                if (detectedThreatType !== 'NONE') {
                    if (currentContact.aiMode !== 'EVADE') {
                         if (currentContact.aiReactionTimer === undefined) {
                              if (detectedThreatType === 'ACTIVE') {
                                  currentContact.aiReactionTimer = 0; // Immediate
                              } else {
                                  currentContact.aiReactionTimer = detectedInBaffles ? 10 : 2;
                              }
                         }

                         if (currentContact.aiReactionTimer <= 0) {
                             currentContact.aiMode = 'EVADE';
                             currentContact.aiReactionTimer = undefined;
                         } else {
                             currentContact.aiReactionTimer -= 1;
                         }
                    }
                } else {
                     // If threat lost, reset timer?
                     // If we were counting down but threat disappeared (e.g. out of range), reset.
                     if (currentContact.aiMode !== 'EVADE') {
                        currentContact.aiReactionTimer = undefined;
                     }
                }

                // 5. Behavior
                if (currentContact.aiMode === 'EVADE') {
                    currentContact.speed = 25;
                    const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);
                    const bearingToOwnship = normalizeAngle(90 - angleToOwnship);
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

      // Detect fire requests (Transitioned to cooldown this tick)
      const enemyFireRequests: { shooterId: string; x: number; y: number; heading: number }[] = [];
      newContacts.forEach(c => {
          if (c.aiMode === 'EVADE' && c.torpedoCooldown === 600) {
              // Just fired
              enemyFireRequests.push({ shooterId: c.id, x: c.x, y: c.y, heading: c.heading || 0 });
          }
      });

      const generatedTorpedoes: Torpedo[] = enemyFireRequests.map(req => ({
          id: `T-${Math.floor(state.gameTime)}-${req.shooterId}`,
          position: { x: req.x, y: req.y },
          heading: req.heading,
          targetHeading: req.heading,
          speed: 20, // Launch speed
          status: 'RUNNING',
          launchTime: state.gameTime,
          searchMode: 'ACTIVE',
          designatedTargetId: 'OWNSHIP',
          activeTargetId: undefined,
          enableRange: 500,
          gyroAngle: req.heading,
          distanceTraveled: 0
      }));

      // Update Torpedoes & Collision Check
      let newScriptedEvents = [...state.scriptedEvents];
      let newVisualTransients = [...state.visualTransients];
      let newLogs = state.logs;

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

        if (newTotalDistance > 20000) {
            finalStatus = 'DUD';
        }

        if (newTotalDistance >= torpedo.enableRange && finalStatus === 'RUNNING') {
           // Acquisition Logic (Active Seeker)
           if (!finalActiveTargetId) {
                let bestContactId = undefined;
                let minDist = 2000; // Seeker Range

                // Prioritize designated target
                if (torpedo.designatedTargetId) {
                    if (torpedo.designatedTargetId === 'OWNSHIP') {
                        const dx = state.x - torpedo.position.x;
                        const dy = state.y - torpedo.position.y;
                        const distToContact = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                        if (distToContact < 2000) {
                            const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                            const bearingToContact = normalizeAngle(90 - mathAngle);
                            let relBearing = Math.abs(bearingToContact - newHeading);
                            if (relBearing > 180) relBearing = 360 - relBearing;

                            if (relBearing < 45) {
                                bestContactId = 'OWNSHIP';
                            }
                        }
                    } else {
                        const contact = newContacts.find(c => c.id === torpedo.designatedTargetId && c.status !== 'DESTROYED');
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
                }

                // If not found designated, check all contacts AND OWNSHIP
                if (!bestContactId) {
                    // Check Ownship
                    const dx = state.x - torpedo.position.x;
                    const dy = state.y - torpedo.position.y;
                    const distToContact = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                    if (distToContact < 2000) {
                        const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                        const bearingToContact = normalizeAngle(90 - mathAngle);
                        let relBearing = Math.abs(bearingToContact - newHeading);
                        if (relBearing > 180) relBearing = 360 - relBearing;

                        if (relBearing < 45) {
                            if (distToContact < minDist) {
                                minDist = distToContact;
                                bestContactId = 'OWNSHIP';
                            }
                        }
                    }

                    for (const contact of newContacts) {
                        if (contact.status === 'DESTROYED') continue;
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
        else {
            newHeading = torpedo.gyroAngle;
        }

        // Phase 3: Homing (Pure Pursuit) and COLLISION CHECK
        if (finalActiveTargetId && finalStatus === 'RUNNING') {
             let targetX = 0, targetY = 0;
             let validTarget = false;

             if (finalActiveTargetId === 'OWNSHIP') {
                 targetX = state.x;
                 targetY = state.y;
                 validTarget = true;
             } else {
                 const contact = newContacts.find(c => c.id === finalActiveTargetId);
                 if (contact && contact.status !== 'DESTROYED') {
                     targetX = contact.x;
                     targetY = contact.y;
                     validTarget = true;
                 }
             }

             if (validTarget) {
                 const dx = targetX - torpedo.position.x;
                 const dy = targetY - torpedo.position.y;
                 const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                 const bearingToContact = normalizeAngle(90 - mathAngle);
                 newHeading = bearingToContact;

                 // Proximity Fuse (Detonation)
                 const distToContact = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                 if (distToContact < 40) { // Updated Threshold
                     finalStatus = 'EXPLODED';

                     // IMPACT LOGIC
                     // Calculate relative bearing from ownship to explosion
                     const expDx = torpedo.position.x - newX;
                     const expDy = torpedo.position.y - newY;
                     const expAngle = Math.atan2(expDy, expDx) * (180 / Math.PI);
                     const expBearing = normalizeAngle(90 - expAngle);

                     newVisualTransients.push({
                         bearing: expBearing,
                         intensity: 1.0,
                         timestamp: state.gameTime + (1/60)
                     });

                     if (finalActiveTargetId === 'OWNSHIP') {
                         // Hit Ownship
                         newScriptedEvents.push({
                             time: state.gameTime + (1/60),
                             type: 'LOG',
                             payload: { message: `ALARM: HULL BREACH! TORPEDO IMPACT!`, type: 'ALERT' }
                         });
                         // Maybe slow down ownship or create damage?
                     } else {
                         // Hit Contact
                         const contact = newContacts.find(c => c.id === finalActiveTargetId);
                         if (contact) {
                             newContacts = newContacts.map(c => c.id === contact.id ? { ...c, status: 'DESTROYED' } : c);

                             // Schedule Events
                             const hitTime = state.gameTime + (1/60);
                             newScriptedEvents.push({
                                 time: hitTime,
                                 type: 'LOG',
                                 payload: { message: `Conn, Sonar: Loud transient bearing ${Math.round(expBearing)}!`, type: 'ALERT' }
                             });
                             newScriptedEvents.push({
                                 time: hitTime + 5,
                                 type: 'LOG',
                                 payload: { message: `Conn, Sonar: Breaking up noises confirmed on ${contact.id}.`, type: 'INFO' }
                             });
                             newScriptedEvents.push({
                                 time: hitTime + 15,
                                 type: 'LOG',
                                 payload: { message: `Conn, Sonar: Contact ${contact.id} lost.`, type: 'INFO' }
                             });
                             newScriptedEvents.push({
                                 time: hitTime + 15,
                                 type: 'DELETE_TRACKER',
                                 payload: { contactId: contact.id }
                             });
                             newScriptedEvents.push({
                                time: hitTime + 15,
                                type: 'RESET_ALERT',
                                payload: {}
                             });
                         }
                     }
                 }
             } else {
                 finalActiveTargetId = undefined; // Lost lock or target destroyed
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

      // Filter out dead torpedoes
      const activeTorpedoes = [...newTorpedoes, ...generatedTorpedoes].filter(t => t.status !== 'DUD' && t.status !== 'EXPLODED');

      // Sensor Simulation
      const newSensorReadings = newContacts.reduce((acc, contact) => {
        // Skip destroyed contacts in sensors
        if (contact.status === 'DESTROYED') return acc;

        // Calculate True Bearing
        const dx = contact.x - newX;
        const dy = contact.y - newY;
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

      const newTickCount = state.tickCount + 1;
      const newGameTime = state.gameTime + (1/60);

      // Process Scripted Events
      let remainingEvents = [];
      let trackersToDelete: string[] = [];
      let shouldResetAlert = false;

      for (const event of newScriptedEvents) {
          if (newGameTime >= event.time) {
              // Execute Event
              if (event.type === 'LOG') {
                  newLogs = [...newLogs, { message: event.payload.message, timestamp: newGameTime, type: event.payload.type }].slice(-50);
              } else if (event.type === 'DELETE_TRACKER') {
                  // Find tracker with this contactId
                  const tracker = state.trackers.find(t => t.contactId === event.payload.contactId);
                  if (tracker) {
                      trackersToDelete.push(tracker.id);
                  }
              } else if (event.type === 'RESET_ALERT') {
                  shouldResetAlert = true;
              }
          } else {
              remainingEvents.push(event);
          }
      }
      newScriptedEvents = remainingEvents;

      // Update Trackers
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
                const contact = newContacts.find(c => c.id === updatedTracker.contactId);
                const type = contact?.classification || 'UNKNOWN';
                updatedTracker.classification = type;

                // Log
                const isHostile = type === 'SUB';
                newLogs = [...newLogs, {
                    message: `Conn, Sonar: Contact ${updatedTracker.id} classified as ${type}.`,
                    timestamp: newGameTime,
                    type: isHostile ? 'ALERT' : 'INFO'
                }].slice(-50);
            }
        }

        return updatedTracker;
      });

      // Filter deleted trackers
      if (trackersToDelete.length > 0) {
          newTrackers = newTrackers.filter(t => !trackersToDelete.includes(t.id));
      }

      // Update Alert Level
      // Combat if any active tracker is SUB
      const combatActive = newTrackers.some(t => t.classification === 'SUB');
      let newAlertLevel = combatActive ? 'COMBAT' : 'NORMAL';

      // Clean up old visual transients (> 5 seconds)
      newVisualTransients = newVisualTransients.filter(t => newGameTime - t.timestamp < 5);

      // Every 60 ticks (approx 1 sec), record history
      let newOwnShipHistory = state.ownShipHistory;
      if (newTickCount % 60 === 0) {
        newTrackers = newTrackers.map(tracker => {
          // Check for active sensor reading (Baffle Cutoff)
          const hasReading = newSensorReadings.some(r => r.contactId === tracker.contactId);

          // Reviewer Requirement: Explicitly prevent TMA History updates if bearing is in baffles
          // (Even if sensor reading exists due to noise or logic variance)
          const rb = normalizeAngle(tracker.currentBearing);
          const inBaffles = rb > 150 && rb < 210;

          let newHistory = tracker.bearingHistory;
          if (hasReading && !inBaffles) {
            newHistory = [
              ...tracker.bearingHistory,
              { time: newGameTime, bearing: tracker.currentBearing }
            ];
            if (newHistory.length > MAX_HISTORY) {
              newHistory = newHistory.slice(newHistory.length - MAX_HISTORY);
            }
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

      // Update Tubes (Progress and Auto-Sequence)
      let tubesUpdated = [...state.tubes];
      let newTransients = [...activeTransients];

      tubesUpdated = tubesUpdated.map(tube => {
        let updatedTube = { ...tube };

        // Handle Progress Transitions
        if (['LOADING', 'FLOODING', 'EQUALIZING', 'OPENING', 'FIRING'].includes(updatedTube.status)) {
          updatedTube.progress += 1;
          if (updatedTube.progress >= 100) {
            updatedTube.progress = 0;
            switch (updatedTube.status) {
              case 'LOADING': updatedTube.status = 'DRY'; break;
              case 'FLOODING': updatedTube.status = 'WET'; break;
              case 'EQUALIZING': updatedTube.status = 'EQUALIZED'; break;
              case 'OPENING': updatedTube.status = 'OPEN'; break;
              case 'FIRING':
                  updatedTube.status = 'EMPTY';
                  updatedTube.weaponData = null;
                  break;
            }
          }
        }
        return updatedTube;
      });

      // Handle Auto-Sequence
      tubesUpdated = tubesUpdated.map(tube => {
          if (tube.autoSequence) {
              if (tube.status === 'DRY') {
                  newTransients.push({ type: 'TUBE_FLOOD', startTime: newGameTime, duration: 10, magnitude: 0.2 });
                  return { ...tube, status: 'FLOODING', progress: 0 };
              }
              if (tube.status === 'WET') {
                  return { ...tube, status: 'EQUALIZING', progress: 0 };
              }
              if (tube.status === 'EQUALIZED') {
                  newTransients.push({ type: 'MUZZLE_OPEN', startTime: newGameTime, duration: 10, magnitude: 0.3 });
                  return { ...tube, status: 'OPENING', progress: 0 };
              }
              if (tube.status === 'OPEN') {
                  newLogs = [...newLogs, { message: `OOD, Fire Control, Tube #${tube.id} is ready in all respects`, timestamp: newGameTime }].slice(-50);
                  return { ...tube, autoSequence: false };
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
        contacts: newContacts,
        sensorReadings: newSensorReadings,
        logs: newLogs,
        tickCount: newTickCount,
        gameTime: newGameTime,
        trackers: newTrackers,
        tubes: tubesUpdated,
        torpedoes: activeTorpedoes,
        ownshipNoiseLevel: totalNoise,
        cavitating: isCavitating,
        transients: newTransients,
        visualTransients: newVisualTransients,
        scriptedEvents: newScriptedEvents,
        alertLevel: newAlertLevel
      };
    }),
}));
