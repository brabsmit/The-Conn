import { create } from 'zustand';
import { generateNoisySolution } from '../lib/SolutionAI';
import { getDirectorUpdates } from '../lib/ScenarioDirector';
import { ACOUSTICS } from '../config/AcousticConstants';
import { AcousticsEngine } from '../lib/AcousticsEngine';
import {
  normalizeAngle,
  gaussianRandom,
  checkCollision,
  FEET_PER_KNOT_PER_TICK
} from '../lib/math';
import type {
  SubmarineState,
  Tracker,
  Tube,
  Torpedo,
  SensorReading,
  Contact,
  WeaponData,
  EntityHistory,
  TrackerHistory,
  OwnShipHistory,
  Station,
  ViewScale,
  TrackerSolution,
  TubeStatus,
  Transient,
  VisualTransient,
  ScriptedEvent,
  GameMetrics
} from './types';

export * from './types';

// Physics constants
const TURN_RATE = 0.5; // degrees per tick
const ACCELERATION = 0.05; // knots per tick
const DECELERATION = 0.05; // knots per tick
const DIVE_RATE = 1.0; // feet per tick
const ASCENT_RATE = 1.0; // feet per tick
const MAX_HISTORY = 25000;

// FULL DEFAULT STATE FOR RESET
const getInitialState = (): Omit<SubmarineState, 'setAppState' | 'setExpertMode' | 'toggleGodMode' | 'setOrderedHeading' | 'setOrderedSpeed' | 'setOrderedDepth' | 'addLog' | 'designateTracker' | 'setSelectedTracker' | 'deleteTracker' | 'updateTrackerSolution' | 'addSolutionLeg' | 'setViewScale' | 'setActiveStation' | 'loadTube' | 'floodTube' | 'equalizeTube' | 'openTube' | 'fireTube' | 'addContact' | 'updateContact' | 'removeContact' | 'loadScenario' | 'resetSimulation' | 'tick'> => ({
  appState: 'MENU',
  expertMode: false,
  godMode: false,
  scenarioId: null,
  metrics: {
      minRangeToContact: Infinity,
      counterDetectionTime: 0,
      tmaErrorAccumulator: 0,
      tmaErrorCount: 0
  },
  gameState: 'RUNNING',
  heading: 0,
  speed: 0,
  depth: 0,
  x: 0,
  y: 0,
  fuel: 100,
  battery: 100,
  ownShipHistory: [],
  ownshipNoiseLevel: 0.1,
  cavitating: false,
  transients: [],
  visualTransients: [],
  activeIntercepts: [],
  scriptedEvents: [],
  contacts: [],
  sensorReadings: [],
  logs: [],
  alertLevel: 'NORMAL',
  incomingTorpedoDetected: false,
  trackers: [],
  selectedTrackerId: null,
  tubes: Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    status: 'EMPTY' as const,
    progress: 0,
    weaponData: null
  })),
  torpedoes: [],
  tickCount: 0,
  gameTime: 0,
  viewScale: 'FAST',
  activeStation: 'TMA',
  orderedHeading: 0,
  orderedSpeed: 5,
  orderedDepth: 150,
});

export const useSubmarineStore = create<SubmarineState>((set, get) => ({
  ...getInitialState(),

  setAppState: (appState) => set({ appState }),
  setExpertMode: (expertMode) => set({ expertMode, godMode: false }), // Disable god mode if expert enabled (default)
  toggleGodMode: () => set((state) => ({ godMode: !state.godMode })),

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
      displayBearing: bearing,
      bearingHistory: [],
      solution: {
        legs: [{
          startTime: state.gameTime,
          startRange: 10000,
          startBearing: normalizeAngle(bearing + state.heading),
          course: 0,
          speed: 10,
          startOwnShip: { x: state.x, y: state.y, heading: state.heading }
        }],
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
      timeToClassify: 15,
      creationTime: state.gameTime, // Task 115.1
      lastInteractionTime: state.gameTime, // Task 115.1
      isAutoSolution: false // Task 115.1
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

      // Note: This logic assumes we are always updating the LATEST LEG (or active leg params)
      // When we update speed/course/range/bearing, we are updating the active snapshot.

      const mergedSolution = { ...t.solution, ...solutionUpdates };

      // Sync logic
      let newLegs = [...(mergedSolution.legs || [])];

      // Case A: Legs were provided in updates. Sync flat fields to match the last leg.
      if (solutionUpdates.legs && newLegs.length > 0) {
          const lastLeg = newLegs[newLegs.length - 1];
          mergedSolution.speed = lastLeg.speed;
          mergedSolution.course = lastLeg.course;
          mergedSolution.range = lastLeg.startRange;
          mergedSolution.bearing = lastLeg.startBearing;
          mergedSolution.anchorTime = lastLeg.startTime;
          mergedSolution.anchorOwnShip = lastLeg.startOwnShip;
      }
      // Case B: Flat fields were provided (Legacy/Simple UI). Sync last leg to match.
      else if (newLegs.length > 0) {
        const lastIndex = newLegs.length - 1;
        const lastLeg = newLegs[lastIndex];

        newLegs[lastIndex] = {
            ...lastLeg,
            speed: mergedSolution.speed,
            course: mergedSolution.course,
            startRange: mergedSolution.range,
            startBearing: mergedSolution.bearing,
            startTime: mergedSolution.anchorTime,
            startOwnShip: mergedSolution.anchorOwnShip
        };
      }

      // Re-calculate anchor position based on current ownship and new solution parameters
      const bearingRad = (mergedSolution.bearing * Math.PI) / 180;
      const rangeFt = mergedSolution.range * 3;

      const relX = rangeFt * Math.sin(bearingRad);
      const relY = rangeFt * Math.cos(bearingRad);

      return {
        ...t,
        solution: {
          ...mergedSolution,
          legs: newLegs,
          // Legacy fields synced
          anchorTime: mergedSolution.anchorTime || state.gameTime, // Fallback if undefined
          anchorOwnShip: mergedSolution.anchorOwnShip || { x: state.x, y: state.y, heading: state.heading },
          computedWorldX: (mergedSolution.anchorOwnShip?.x || state.x) + relX,
          computedWorldY: (mergedSolution.anchorOwnShip?.y || state.y) + relY
        },
        lastInteractionTime: state.gameTime, // Task 115.1
        isAutoSolution: false // Task 115.1
      };
    })
  })),

  addSolutionLeg: (trackerId) => set((state) => {
      // Logic to add a new leg to the tracker solution
      // We do this by projecting the current solution to "now" and starting a new leg there.

      const newTrackers = state.trackers.map(t => {
          if (t.id !== trackerId) return t;

          // Simplified calc (Dead Reckoning):
          // 1. Get current world pos of target from solution
          const solution = t.solution;
          const dt = state.gameTime - solution.anchorTime;
          const speedFtSec = solution.speed * 1.6878;
          const radC = (solution.course * Math.PI) / 180;

          // World Pos at Anchor
          const radB = (solution.bearing * Math.PI) / 180;
          const rFt = solution.range * 3;
          const ax = solution.anchorOwnShip.x + rFt * Math.sin(radB);
          const ay = solution.anchorOwnShip.y + rFt * Math.cos(radB);

          // Current World Pos
          const tx = ax + Math.sin(radC) * speedFtSec * dt;
          const ty = ay + Math.cos(radC) * speedFtSec * dt;

          // 2. Calculate Range/Bearing from OwnShip NOW
          const currentOwnShip = { x: state.x, y: state.y, heading: state.heading };
          const dx = tx - currentOwnShip.x;
          const dy = ty - currentOwnShip.y;
          const newRange = Math.sqrt(dx*dx + dy*dy) / 3;
          const newBearing = normalizeAngle((Math.atan2(dx, dy) * 180 / Math.PI));

          const newLeg = {
              startTime: state.gameTime,
              startRange: newRange,
              startBearing: newBearing,
              course: solution.course, // Copy previous kinematics initially
              speed: solution.speed,
              startOwnShip: currentOwnShip
          };

          return {
              ...t,
              solution: {
                  ...t.solution,
                  legs: [...(t.solution.legs || []), newLeg],
                  // Update active flat fields
                  range: newRange,
                  bearing: newBearing,
                  anchorTime: state.gameTime,
                  anchorOwnShip: currentOwnShip
              }
          };
      });

      return { trackers: newTrackers };
  }),

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
    contacts: [...state.contacts, { ...contact, status: contact.status || 'ACTIVE', history: [] }]
  })),

  updateContact: (id, updates) => set((state) => ({
    contacts: state.contacts.map(c => {
        if (c.id === id) {
            const updated = { ...c, ...updates };
            // Auto-disable AI if kinematics or sensors are manually adjusted (Task 158.1)
            if (updates.x !== undefined || updates.y !== undefined || updates.heading !== undefined || updates.speed !== undefined || updates.depth !== undefined || updates.sonarState !== undefined) {
                updated.aiDisabled = true;
            }
            return updated;
        }
        return c;
    })
  })),

  removeContact: (id) => set((state) => ({
    contacts: state.contacts.map(c => c.id === id ? { ...c, status: 'DESTROYED' } : c)
  })),

  loadScenario: (newState, id) => set((state) => ({
    ...getInitialState(), // Reset to defaults first
    ...newState,
    // Ensure complex objects are handled
    ownShipHistory: newState.ownShipHistory || [],
    trackers: newState.trackers || [],
    contacts: newState.contacts || [],
    torpedoes: newState.torpedoes || [],
    transients: newState.transients || [],
    sensorReadings: newState.sensorReadings || [],
    tickCount: 0,
    gameTime: 0,
    alertLevel: 'NORMAL',
    incomingTorpedoDetected: false,
    scriptedEvents: [],
    visualTransients: [],
    activeIntercepts: [],
    gameState: 'RUNNING',
    scenarioId: id || null,
    appState: 'GAME'
  })),

  resetSimulation: () => set(getInitialState()),

  fireTube: (tubeId, designatedTargetId, enableRange, gyroAngle) => set((state) => {
    const tube = state.tubes.find(t => t.id === tubeId);
    if (!tube || tube.status !== 'OPEN' || !tube.weaponData) {
      return {};
    }

    const torpedoId = `T-${Date.now()}-${tube.id}`;

    // Defaults if not provided
    const launchHeading = state.heading;
    let commandedGyro = gyroAngle !== undefined ? gyroAngle : state.heading;

    // Fix 91.1: Calculate Gyro if targeted
    if (designatedTargetId && gyroAngle === undefined) {
         if (designatedTargetId === 'OWNSHIP') {
             commandedGyro = state.heading;
         } else {
             const tracker = state.trackers.find(t => t.id === designatedTargetId);
             if (tracker) {
                 commandedGyro = tracker.solution.bearing;
             } else {
                 const contact = state.contacts.find(c => c.id === designatedTargetId);
                 if (contact) {
                     const dx = contact.x - state.x;
                     const dy = contact.y - state.y;
                     const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                     commandedGyro = normalizeAngle(90 - angle);
                 }
             }
         }
    }

    const launchEnableRange = enableRange !== undefined ? enableRange : 1000;

    const newTorpedo: Torpedo = {
      id: torpedoId,
      position: { x: state.x, y: state.y },
      heading: launchHeading,
      targetHeading: commandedGyro,
      speed: 20, // Launch speed
      status: 'RUNNING',
      launchTime: state.gameTime,
      searchMode: tube.weaponData?.searchMode || 'PASSIVE',
      designatedTargetId,
      activeTargetId: undefined, // Not locked initially
      enableRange: launchEnableRange,
      gyroAngle: commandedGyro,
      distanceTraveled: 0,
      isHostile: false,
      history: []
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
      if (state.gameState !== 'RUNNING' || state.appState !== 'GAME') {
        return {};
      }

      const newTickCount = state.tickCount + 1;
      const newGameTime = state.gameTime + (1/60);
      let newLogs = state.logs;
      let newScriptedEvents = [...state.scriptedEvents];
      let newVisualTransients = [...state.visualTransients];

      let newGameState = state.gameState;
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

      // --- Resource Consumption ---
      let newFuel = state.fuel;
      let newBattery = state.battery;

      if (newSpeed > 0) {
        // Arbitrary consumption rates
        const consumption = (newSpeed / 30.0) * 0.01 * delta;
        newFuel = Math.max(0, newFuel - consumption);
        newBattery = Math.max(0, newBattery - consumption);
      }

      // --- Noise Calculation ---
      const baseNoise = 0.1;
      const flowNoise = (newSpeed / 30.0) * 0.4;
      const cavitationThreshold = 12.0;
      const isCavitating = newSpeed > cavitationThreshold;
      const cavitationNoise = isCavitating ? 0.5 : 0;
      const activeTransients = state.transients.filter(t => (state.gameTime - t.startTime) < t.duration);
      const transientNoise = activeTransients.reduce((sum, t) => sum + t.magnitude, 0);
      const totalNoise = baseNoise + flowNoise + cavitationNoise + transientNoise;

      // --- Scenario Event Logic (Director) ---
      const directorUpdates = getDirectorUpdates(state);

      // Handle New Contacts from Director
      let currentContactsList = [...state.contacts];
      if (directorUpdates.newContacts && directorUpdates.newContacts.length > 0) {
          currentContactsList.push(...directorUpdates.newContacts);
      }

      // Filter out Director-removed contacts BEFORE mapping/processing
      if (directorUpdates.removedContactIds && directorUpdates.removedContactIds.length > 0) {
          currentContactsList = currentContactsList.filter(c => !directorUpdates.removedContactIds.includes(c.id));
      }

      // Update Contacts (Truth movement & AI)
      let newContacts = currentContactsList.map(contact => {
        // Skip destroyed contacts movement logic
        if (contact.status === 'DESTROYED') return contact;

        let currentContact = { ...contact };

        // Task 125.3: Signature Dynamics Implementation
        // 1. Base Logic
        const baseSL = currentContact.baseSourceLevel || 120;
        let effectiveSL = baseSL;

        // 2. Dirty Profile (Wobble)
        if (currentContact.acousticProfile === 'DIRTY') {
             // Random Walk: +/- 0.5dB per tick/step? No, per second.
             // Delta is roughly 1.0 = 1/60s.
             // We want +/- 2dB variance range.
             const wobbleStep = (Math.random() - 0.5) * 0.1 * delta; // Small drift
             currentContact.wobbleState = (currentContact.wobbleState || 0) + wobbleStep;

             // Clamp
             const maxWobble = 2.0;
             currentContact.wobbleState = Math.max(-maxWobble, Math.min(maxWobble, currentContact.wobbleState));

             effectiveSL += currentContact.wobbleState;
        }

        // 3. Transient Logic
        // Decay existing
        if (currentContact.transientTimer && currentContact.transientTimer > 0) {
             effectiveSL += 10; // 10dB Spike
             currentContact.transientTimer -= (1/60) * delta;
        } else {
             // Chance to trigger new
             if (currentContact.transientRate) {
                 // Rate is prob per second? Prompt says "0.05".
                 // if rate is 0.05/sec, then prob per tick is 0.05 / 60.
                 const prob = (currentContact.transientRate / 60) * delta;
                 if (Math.random() < prob) {
                     currentContact.transientTimer = 2.0; // 2 second spike
                     effectiveSL += 10; // Immediate spike
                 }
             }
        }

        currentContact.sourceLevel = effectiveSL;

        // Apply Scenario Director Updates
        if (!currentContact.aiDisabled && directorUpdates.contactUpdates[contact.id]) {
            const update = directorUpdates.contactUpdates[contact.id];
            if (update.heading !== undefined) currentContact.heading = update.heading;
            if (update.hasZigged !== undefined) currentContact.hasZigged = update.hasZigged;
        }

        // Scenario 3: Sprint & Drift (Escorts)
        if (state.scenarioId === 'sc3' && currentContact.classification === 'ESCORT' && currentContact.type === 'ENEMY') {
             // 10 min cycle (600s). 0-240 Sprint, 240-600 Drift
             const cycleTime = state.gameTime % 600;
             if (cycleTime < 240) { // Sprint
                 currentContact.speed = 25;
             } else { // Drift
                 currentContact.speed = 5;
             }
        }

        // AI Logic (Only for ENEMY)
        if (currentContact.type === 'ENEMY') {
            if (currentContact.aiDisabled) return currentContact;

            const timeSinceLastUpdate = state.gameTime - (currentContact.aiLastUpdate || 0);

            // Run AI every 1 second
            if (timeSinceLastUpdate >= 1.0) {
                currentContact.aiLastUpdate = state.gameTime;

                // Merchant: Return immediately (No reaction)
                if (currentContact.classification === 'MERCHANT') {
                    // Force maintain IDLE or existing state without processing threats/ownship
                    return currentContact;
                }

                // Trawler: Oblivious (Skip AI, allow Physics)
                if (currentContact.classification === 'TRAWLER') {
                    // Skip remaining AI logic
                } else {

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

                // Task 156.2: AI State Machine (Prosecution Logic)
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

                         // Task 156.2: Transition to PROSECUTE if confidence is high or detected loudly
                         // Threshold for "Prosecute": Strong Passive Lock
                         if (signalExcess > 0.4) {
                             currentContact.aiMode = 'PROSECUTE';
                             currentContact.isActivePingEnabled = true;
                             currentContact.activePingTimer = 0; // Start immediately
                         }

                         // Fallback direct attack if close (Task 156 says Hunt then Shoot, but close quarters requires reaction)
                         if (distYards < 2000) {
                             if (!currentContact.torpedoCooldown || currentContact.torpedoCooldown <= 0) {
                                 currentContact.aiMode = 'ATTACK';
                             }
                         }
                     }
                }

                // C. PROSECUTE State (Active Sonar)
                if (currentContact.aiMode === 'PROSECUTE') {
                    // Turn towards contact
                    const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);
                    const bearingToOwnship = normalizeAngle(90 - angleToOwnship);
                    currentContact.heading = bearingToOwnship;

                    // Speed up to 15kts (Hunt speed)
                    currentContact.speed = 15;

                    // Active Sonar Logic (Below in active ping section)
                    if (!currentContact.isActivePingEnabled) {
                        currentContact.isActivePingEnabled = true;
                    }

                    // Task 158.2: Weapon ROE (The "Nervous" Timer)
                    // If we have a solid lock, start the timer
                    if (signalExcess > 0.9) {
                        if (currentContact.trackingTimer === undefined) currentContact.trackingTimer = 0;
                        currentContact.trackingTimer += timeSinceLastUpdate; // Use calculated delta since last update

                        // Fire logic
                        if (currentContact.trackingTimer > 30) {
                             if (!currentContact.torpedoCooldown || currentContact.torpedoCooldown <= 0) {
                                 currentContact.aiMode = 'ATTACK';
                                 currentContact.trackingTimer = 0;
                             }
                        }
                    } else {
                        // Reset if lock falters significantly? Or just decay?
                        // For now, reset to avoid firing on lucky pings.
                        currentContact.trackingTimer = 0;
                    }

                    // Lost contact?
                    // If active return fails repeatedly? Handled in Return Logic or just use passive fallback.
                    // If signalExcess drops too low
                    if (signalExcess < -0.5) {
                        currentContact.aiMode = 'PATROL';
                        currentContact.isActivePingEnabled = false;
                        currentContact.trackingTimer = 0;
                    }
                }

                // D. ATTACK State ("The Ambush")
                if (currentContact.aiMode === 'ATTACK') {
                    if (!currentContact.torpedoCooldown || currentContact.torpedoCooldown <= 0) {
                        currentContact.torpedoCooldown = 600; // Cooldown
                        currentContact.aiMode = 'EVADE'; // Fire and Evade
                    }
                }

                // E. Threat Perception (Torpedoes)
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
                } // End Trawler Check
            }
        }

        // --- Manual Active Sonar Override Logic (Task 157) ---
        // Force Active State or Silence (Takes precedence over AI)
        if (currentContact.sonarState === 'ACTIVE') {
            currentContact.isActivePingEnabled = true;
        } else if (currentContact.sonarState === 'SILENT') {
            currentContact.isActivePingEnabled = false;
        }
        // If AUTO, we let AI decide (or maintain current state)

        // Force One-Shot Ping
        if (currentContact.forceOneShotPing) {
            currentContact.forceOneShotPing = false; // Reset flag immediately
            currentContact.activePingTimer = 0; // Trigger immediately in the active sonar block below
            currentContact.isActivePingEnabled = true; // Ensure it's enabled for at least this tick
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

      // --- Active Sonar Logic (Global Event Processing) ---
      let newActiveIntercepts = [...state.activeIntercepts];

      newContacts = newContacts.map(contact => {
          if (contact.status === 'DESTROYED' || !contact.isActivePingEnabled) return contact;

          let updatedContact = { ...contact };
          const pingInterval = ACOUSTICS.ACTIVE_SONAR.INTERVAL;

          // Decrement Timer
          if (updatedContact.activePingTimer === undefined) updatedContact.activePingTimer = 0;
          updatedContact.activePingTimer -= (1/60) * delta;

          if (updatedContact.activePingTimer <= 0) {
              // PING!
              updatedContact.activePingTimer = pingInterval;

              const dx = state.x - contact.x;
              const dy = state.y - contact.y;
              const distYards = Math.sqrt(dx * dx + dy * dy) / 3;
              const deepWater = true; // Assumption

              // 1. One-Way (Intercept) - Player hears it?
              const interceptSignal = AcousticsEngine.calculateActiveOneWay(ACOUSTICS.ACTIVE_SONAR.SL, distYards, deepWater);
              const interceptThreshold = 0; // 0dB detection threshold for intercept? Usually highly audible.

              if (interceptSignal > interceptThreshold) {
                   // Calculate Bearing of source relative to ownship
                   // Vector from Ownship TO Contact is (dx, dy) reversed: contact.x - state.x
                   const dxSource = contact.x - state.x;
                   const dySource = contact.y - state.y;
                   const mathAngle = Math.atan2(dySource, dxSource) * (180 / Math.PI);
                   const bearingToSource = normalizeAngle(90 - mathAngle);

                   // Add Intercept Event
                   newActiveIntercepts.push({
                       bearing: bearingToSource,
                       timestamp: newGameTime,
                       sourceId: contact.id
                   });

                   // Log
                   if (interceptSignal > 10) {
                       newLogs = [...newLogs, {
                           message: `Conn, Sonar: HIGH FREQUENCY INTERCEPT! Bearing ${Math.round(bearingToSource)}!`,
                           type: 'ALERT' as const,
                           timestamp: newGameTime
                       }].slice(-50);
                   }
              }

              // 2. Two-Way (Return) - Enemy hears us?
              const returnSignal = AcousticsEngine.calculateActiveTwoWay(
                  ACOUSTICS.ACTIVE_SONAR.SL,
                  distYards,
                  ACOUSTICS.OWNSHIP_TARGET_STRENGTH,
                  deepWater
              );

              const detectionThreshold = 0; // 0dB excess needed
              if (returnSignal > detectionThreshold && contact.type === 'ENEMY') {
                  // Confirmed Range/Bearing
                  // Trigger Attack if in range
                  if (distYards < 6000) { // Extended attack range for active
                       if (!updatedContact.torpedoCooldown || updatedContact.torpedoCooldown <= 0) {
                           updatedContact.aiMode = 'ATTACK';
                           newLogs = [...newLogs, {
                               message: `Conn, Sonar: Active Return Detected by ${contact.id}! Launch Transient!`,
                               type: 'ALERT' as const,
                               timestamp: newGameTime
                           }].slice(-50);
                       }
                  }
              }
          }
          return updatedContact;
      });

      // Cleanup old intercepts (> 2 seconds)
      newActiveIntercepts = newActiveIntercepts.filter(i => newGameTime - i.timestamp < 2.0);

      // Detect fire requests (Transitioned to cooldown this tick)
      const enemyFireRequests: { shooterId: string; x: number; y: number; heading: number }[] = [];
      newContacts.forEach(c => {
          if (c.aiMode === 'EVADE' && c.torpedoCooldown === 600) {
              // Just fired
              // Calculate Bearing to Ownship for correct firing solution
              const dx = newX - c.x;
              const dy = newY - c.y;
              const angleToOwnship = Math.atan2(dy, dx) * (180 / Math.PI);
              const bearingToOwnship = normalizeAngle(90 - angleToOwnship);

              enemyFireRequests.push({ shooterId: c.id, x: c.x, y: c.y, heading: bearingToOwnship });
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
          searchMode: 'PASSIVE',
          designatedTargetId: 'OWNSHIP',
          activeTargetId: undefined,
          enableRange: 500,
          gyroAngle: req.heading,
          distanceTraveled: 0,
          isHostile: true,
          history: []
      }));

      // Update Torpedoes & Collision Check
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

               // Turn towards Search Heading
               const desired = normalizeAngle(torpedo.gyroAngle + offset);
               const diff = desired - newHeading;
               let turnAmount = diff;
               if (diff > 180) turnAmount = diff - 360;
               if (diff < -180) turnAmount = diff + 360;
               const maxTurn = 3.0 * delta;
               if (Math.abs(turnAmount) < maxTurn) {
                   newHeading = desired;
               } else {
                   newHeading = normalizeAngle(newHeading + Math.sign(turnAmount) * maxTurn);
               }
           }
        }
        else {
            // Transit Phase: Turn towards Gyro
            const desired = torpedo.gyroAngle;
            const diff = desired - newHeading;
            let turnAmount = diff;
            if (diff > 180) turnAmount = diff - 360;
            if (diff < -180) turnAmount = diff + 360;
            const maxTurn = 3.0 * delta; // Fast turn for torpedo
            if (Math.abs(turnAmount) < maxTurn) {
                newHeading = desired;
            } else {
                newHeading = normalizeAngle(newHeading + Math.sign(turnAmount) * maxTurn);
            }
        }

        // Apply Heading Prediction for Collision Check
        const torpRadHeading = (newHeading * Math.PI) / 180;
        const torpNewX = torpedo.position.x + distThisTick * Math.sin(torpRadHeading);
        const torpNewY = torpedo.position.y + distThisTick * Math.cos(torpRadHeading);

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

                 // Update heading for next tick (or current tick?)
                 // If we update heading now, we should re-calculate torpNewX?
                 // Homing implies we turn towards target.
                 // "Pure Pursuit".
                 // If we turn now, we move in that direction THIS tick?
                 // Usually yes.
                 newHeading = bearingToContact;
                 const newRad = (newHeading * Math.PI) / 180;
                 // Re-calculate position based on new heading
                 const correctedNewX = torpedo.position.x + distThisTick * Math.sin(newRad);
                 const correctedNewY = torpedo.position.y + distThisTick * Math.cos(newRad);

                 // Proximity Fuse (Detonation) with Raycast
                 // Radius 40 yards = 120 units
                 const hit = checkCollision(
                     torpedo.position.x, torpedo.position.y,
                     correctedNewX, correctedNewY,
                     targetX, targetY,
                     120
                 );

                 if (hit) {
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
                         newGameState = 'DEFEAT';
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

        // Recalculate final position (redundant but safe if homing didn't run)
        const finalRad = (newHeading * Math.PI) / 180;
        const finalNewX = torpedo.position.x + distThisTick * Math.sin(finalRad);
        const finalNewY = torpedo.position.y + distThisTick * Math.cos(finalRad);

        return {
          ...torpedo,
          speed: newSpeed,
          heading: newHeading,
          position: { x: finalNewX, y: finalNewY },
          distanceTraveled: newTotalDistance,
          status: finalStatus,
          activeTargetId: finalActiveTargetId
        };
      });

      const allTorpedoes = [...newTorpedoes, ...generatedTorpedoes];

      // Detect Incoming Torpedoes
      let newIncomingTorpedoDetected = false;
      const weaponTrackers: Tracker[] = [];

      allTorpedoes.forEach(torp => {
          if (torp.status === 'RUNNING' && torp.isHostile) {
              const dx = torp.position.x - newX;
              const dy = torp.position.y - newY;
              const distYards = Math.sqrt(dx*dx + dy*dy) / 3;

              // Check Baffles
              const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI);
              const trueBearing = normalizeAngle(90 - mathAngle);
              const relBearing = normalizeAngle(trueBearing - newHeading);
              const inBaffles = relBearing > 150 && relBearing < 210;

              const active = torp.searchMode === 'ACTIVE' && distYards < 4000;
              const passive = distYards < (inBaffles ? 1000 : 3000);

              if (active || passive) {
                  newIncomingTorpedoDetected = true;

                  // Update or Create Weapon Tracker
                  const trackerId = `W-${torp.id}`;

                  // Task 91.2: Watch Team Deduplication
                  // Prevent processing the same weapon multiple times in one tick
                  if (weaponTrackers.some(t => t.id === trackerId)) {
                      return;
                  }

                  let tracker = state.trackers.find(t => t.id === trackerId);

                  // Solution Logic (Truth + Noise if passive)
                  let solX = torp.position.x;
                  let solY = torp.position.y;

                  if (!active) {
                      // Add some noise for passive detection
                      solX += gaussianRandom(0, 50);
                      solY += gaussianRandom(0, 50);
                  }

                  if (!tracker) {
                      newLogs = [...newLogs, {
                          message: `Conn, Sonar: TORPEDO DETECTED! Bearing ${Math.round(trueBearing)}!`,
                          timestamp: newGameTime,
                          type: 'ALERT'
                      }].slice(-50);

                      // Note: We don't set alertLevel here directly, it is calculated at the end of the tick based on trackers.

                      tracker = {
                          id: trackerId,
                          kind: 'WEAPON',
                          currentBearing: relBearing, // Keep it relative for display
                          displayBearing: relBearing,
                          bearingHistory: [],
                          solution: {
                              legs: [{
                                startTime: newGameTime,
                                startRange: distYards,
                                startBearing: trueBearing,
                                course: torp.heading,
                                speed: torp.speed,
                                startOwnShip: { x: newX, y: newY, heading: newHeading }
                              }],
                              speed: torp.speed,
                              range: distYards,
                              course: torp.heading,
                              bearing: trueBearing,
                              anchorTime: newGameTime,
                              anchorOwnShip: { x: newX, y: newY, heading: newHeading },
                              computedWorldX: solX,
                              computedWorldY: solY
                          },
                          classificationStatus: 'CLASSIFIED',
                          timeToClassify: 0,
                          classification: 'TORPEDO',
                          creationTime: newGameTime, // Task 115.1
                          lastInteractionTime: newGameTime // Task 115.1
                      };
                  } else {
                       // Update existing weapon tracker
                       // Task 137.2: Apply Smoothing to Weapons too
                       let diff = relBearing - (tracker.displayBearing !== undefined ? tracker.displayBearing : relBearing);
                       while (diff < -180) diff += 360;
                       while (diff > 180) diff -= 360;
                       const smoothed = (tracker.displayBearing !== undefined ? tracker.displayBearing : relBearing) + (diff * 0.1);

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
                               anchorTime: newGameTime,
                               anchorOwnShip: { x: newX, y: newY, heading: newHeading },
                               computedWorldX: solX,
                               computedWorldY: solY
                           }
                       };
                  }
                  weaponTrackers.push(tracker);
              }
          }
      });

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

      // Update Trackers (Sensors + Weapons)
      let newTrackers = state.trackers.filter(t => t.kind !== 'WEAPON').map(tracker => {
        let updatedTracker = { ...tracker };

        // Follow contact if locked
        if (updatedTracker.contactId) {
          const reading = newSensorReadings.find(r => r.contactId === updatedTracker.contactId);
          if (reading) {
             updatedTracker.currentBearing = reading.bearing;
          }
        }

        // Task 137.2: The "Needle Mass" (Smoothing)
        // Lerp displayBearing to currentBearing
        const target = updatedTracker.currentBearing;
        let diff = target - (updatedTracker.displayBearing !== undefined ? updatedTracker.displayBearing : target);

        // Wrap Logic
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        // Apply Lerp (0.1)
        const smoothed = (updatedTracker.displayBearing !== undefined ? updatedTracker.displayBearing : target) + (diff * 0.1);
        updatedTracker.displayBearing = normalizeAngle(smoothed);

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

        // Task 115.3: Automated FTOW (Safety Net)
        if (
            updatedTracker.kind !== 'WEAPON' &&
            updatedTracker.contactId &&
            !updatedTracker.isAutoSolution &&
            (updatedTracker.creationTime !== undefined) &&
            (newGameTime - updatedTracker.creationTime > 30) &&
            (updatedTracker.lastInteractionTime === updatedTracker.creationTime) // User hasn't touched it
        ) {
             const contact = newContacts.find(c => c.id === updatedTracker.contactId);
             if (contact) {
                 const noisySol = generateNoisySolution(contact, newGameTime, { x: newX, y: newY, heading: newHeading });
                 updatedTracker.solution = noisySol;
                 updatedTracker.isAutoSolution = true;

                 // Log
                 newLogs = [...newLogs, {
                     message: `FTOW: MLE APPLIED on ${updatedTracker.id}`,
                     type: 'INFO',
                     timestamp: newGameTime
                 }].slice(-50);
             }
        }

        return updatedTracker;
      });

      // Merge Weapon Trackers
      newTrackers = [...newTrackers, ...weaponTrackers];

      // Filter deleted trackers
      if (trackersToDelete.length > 0) {
          newTrackers = newTrackers.filter(t => !trackersToDelete.includes(t.id));
      }

      // Filter trackers for Director-removed contacts
      if (directorUpdates.removedContactIds && directorUpdates.removedContactIds.length > 0) {
           newTrackers = newTrackers.filter(t => !t.contactId || !directorUpdates.removedContactIds.includes(t.contactId));
      }

      // Update Alert Level
      // Combat if any active tracker is SUB or Incoming Torpedo
      const combatActive = newTrackers.some(t => t.classification === 'SUB') || newIncomingTorpedoDetected;
      let newAlertLevel: 'NORMAL' | 'COMBAT' = combatActive ? 'COMBAT' : 'NORMAL';

      // Log All Clear
      if (state.incomingTorpedoDetected && !newIncomingTorpedoDetected) {
          newLogs = [...newLogs, {
              message: `Conn, Sonar: Torpedo noise ceasing. Contact lost.`,
              timestamp: newGameTime
          }].slice(-50);
      }

      // Clean up old visual transients (> 5 seconds)
      newVisualTransients = newVisualTransients.filter(t => newGameTime - t.timestamp < 5);

      let newMetrics = { ...state.metrics };
      let newOwnShipHistory = state.ownShipHistory;

      // Every 60 ticks (approx 1 sec)
      if (newTickCount % 60 === 0) {
        // --- SCORING / METRICS ---
        // 1. Min Range (to any active enemy)
        let minDistToEnemy = Infinity;
        let isDetectedByEnemy = false;

        newContacts.forEach(c => {
            if (c.status === 'ACTIVE' && c.type === 'ENEMY') {
                const dx = c.x - newX;
                const dy = c.y - newY;
                const distYards = Math.sqrt(dx*dx + dy*dy) / 3;
                if (distYards < minDistToEnemy) minDistToEnemy = distYards;

                // 2. Counter-Detection Check
                // Re-use logic: Signal Strength at Enemy = OwnshipNoise / DistSq * Sensitivity
                const sensitivity = c.sensitivity !== undefined ? c.sensitivity : 300000000;
                const signalStrength = (totalNoise / Math.max(1, dx*dx + dy*dy)) * sensitivity;
                if (signalStrength > 0.5) { // 0.5 is threshold used in AI
                    isDetectedByEnemy = true;
                }
            }
        });
        if (minDistToEnemy < newMetrics.minRangeToContact) {
            newMetrics.minRangeToContact = minDistToEnemy;
        }
        if (isDetectedByEnemy) {
            newMetrics.counterDetectionTime += 1; // 1 second
        }

        // 3. TMA Error
        newTrackers.forEach(t => {
            if (t.classificationStatus === 'CLASSIFIED' && t.contactId) {
                 const c = newContacts.find(c => c.id === t.contactId);
                 if (c && c.status === 'ACTIVE') {
                     // Calculate Solution Position at current time
                     // DR from Anchor
                     const dt = newGameTime - t.solution.anchorTime;
                     const spd = t.solution.speed * 1.6878;
                     const radC = (t.solution.course * Math.PI) / 180;
                     const solX = t.solution.computedWorldX + Math.sin(radC) * spd * dt;
                     const solY = t.solution.computedWorldY + Math.cos(radC) * spd * dt;

                     const dx = c.x - solX;
                     const dy = c.y - solY;
                     const err = Math.sqrt(dx*dx + dy*dy) / 3; // yards
                     newMetrics.tmaErrorAccumulator += err;
                     newMetrics.tmaErrorCount += 1;
                 }
            }
        });

        // Record Tracker History
        newTrackers = newTrackers.map(tracker => {
          // Check for active sensor reading (Baffle Cutoff)
          const hasReading = newSensorReadings.some(r => r.contactId === tracker.contactId);

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

        // Record Contact History (Truth)
        newContacts = newContacts.map(c => {
            let h = c.history || [];
            h = [...h, { time: newGameTime, x: c.x, y: c.y, heading: c.heading }];
            if (h.length > MAX_HISTORY) {
                h = h.slice(h.length - MAX_HISTORY);
            }
            return {
                ...c,
                history: h
            };
        });

        // Record Torpedo History
        for (let i = 0; i < allTorpedoes.length; i++) {
             const t = allTorpedoes[i];
             let h = t.history || [];
             h = [...h, { time: newGameTime, x: t.position.x, y: t.position.y, heading: t.heading }];
             if (h.length > MAX_HISTORY) {
                 h = h.slice(h.length - MAX_HISTORY);
             }
             allTorpedoes[i] = {
                 ...t,
                 history: h
             };
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

      // VICTORY / FAILURE CHECKS (SCENARIO SPECIFIC)
      if (newGameState === 'RUNNING') {
          // Failure: Ownship Hit (handled in Torpedo Collision)
          // Additional Failure Conditions
          if (state.scenarioId === 'sc1') { // Safety of Nav
              if (newMetrics.minRangeToContact < 2000) {
                   newGameState = 'DEFEAT';
                   newLogs = [...newLogs, { message: "MISSION FAILED: COLLISION RISK!", timestamp: newGameTime, type: 'ALERT' }];
              }
              if (newGameTime > 30 * 60) {
                   newGameState = 'VICTORY';
              }
          }
          else if (state.scenarioId === 'sc2') { // Duel
              const enemy = newContacts.find(c => c.classification === 'SUB' && c.status === 'ACTIVE');
              if (!enemy) {
                  newGameState = 'VICTORY';
              }
          }
          else if (state.scenarioId === 'sc3') { // SAG
              const hvu = newContacts.find(c => c.classification === 'MERCHANT' && c.type === 'ENEMY'); // HVU usually merchant class but Enemy
              if (!hvu || hvu.status === 'DESTROYED') {
                  newGameState = 'VICTORY';
              }
          }
          else if (state.scenarioId === 'sc4') { // Shadow
               // Win: Sol Quality > 50% for 15 mins (Simplification: Just track duration of contact)
               // Lose: Lose contact > 5 mins or Counter-Detected
               if (newMetrics.counterDetectionTime > 0) { // Instant fail on detection? Task says "Counter Detected".
                   newGameState = 'DEFEAT';
                   newLogs = [...newLogs, { message: "MISSION FAILED: COUNTER-DETECTED!", timestamp: newGameTime, type: 'ALERT' }];
               }

               // Check Contact Loss
               const sub = newContacts.find(c => c.classification === 'SUB');
               if (sub) {
                   const dx = sub.x - newX;
                   const dy = sub.y - newY;
                   const dist = Math.sqrt(dx*dx + dy*dy) / 3;
                   // Assuming detection range 10k?
                   if (dist > 12000) {
                       // Lost contact logic needed? For now strict range check.
                   }
               }
          }
          // Default Victory (Elimination)
          else {
              const activeEnemies = newContacts.filter(c => c.type === 'ENEMY' && c.status === 'ACTIVE');
              if (activeEnemies.length === 0 && newAlertLevel === 'NORMAL') {
                   newGameState = 'VICTORY';
              }
          }
      }

      return {
        gameState: newGameState,
        heading: newHeading,
        speed: newSpeed,
        depth: newDepth,
        x: newX,
        y: newY,
        fuel: newFuel,
        battery: newBattery,
        ownShipHistory: newOwnShipHistory,
        contacts: newContacts,
        sensorReadings: newSensorReadings,
        logs: newLogs,
        tickCount: newTickCount,
        gameTime: newGameTime,
        trackers: newTrackers,
        tubes: tubesUpdated,
        torpedoes: allTorpedoes, // Use the list that includes exploded/duds
        ownshipNoiseLevel: totalNoise,
        cavitating: isCavitating,
        transients: newTransients,
        visualTransients: newVisualTransients,
        activeIntercepts: newActiveIntercepts,
        scriptedEvents: newScriptedEvents,
        alertLevel: newAlertLevel,
        incomingTorpedoDetected: newIncomingTorpedoDetected,
        metrics: newMetrics
      };
    }),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).useSubmarineStore = useSubmarineStore;
}
