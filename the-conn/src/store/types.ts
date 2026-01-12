export interface EntityHistory {
  time: number;
  x: number;
  y: number;
  heading?: number;
}

export interface Contact {
  id: string;
  x: number;
  y: number;
  heading?: number;
  speed?: number;
  type?: 'ENEMY' | 'NEUTRAL';
  classification?: 'MERCHANT' | 'ESCORT' | 'SUB' | 'BIOLOGIC' | 'TRAWLER';
  depth?: number;
  sourceLevel?: number;
  baseSourceLevel?: number;
  acousticProfile?: 'CLEAN' | 'DIRTY';
  transientRate?: number;
  wobbleState?: number;
  transientTimer?: number;
  cavitationSpeed?: number;
  aiMode?: 'IDLE' | 'PATROL' | 'APPROACH' | 'PROSECUTE' | 'ATTACK' | 'EVADE';
  aiLastUpdate?: number;
  aiReactionTimer?: number;
  isActivePingEnabled?: boolean;
  activePingTimer?: number;
  torpedoCooldown?: number;
  canDetectTorpedoes?: boolean;
  sensitivity?: number;
  aiDisabled?: boolean;
  hasZigged?: boolean;
  status?: 'ACTIVE' | 'DESTROYED';
  history?: EntityHistory[];
}

export interface SensorReading {
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

export interface SolutionLeg {
  startTime: number;
  startRange: number;
  startBearing: number; // True Bearing
  course: number;
  speed: number;
  startOwnShip: { x: number, y: number, heading: number };
}

export interface TrackerSolution {
  legs: SolutionLeg[];
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
  displayBearing: number;
  bearingHistory: TrackerHistory[];
  solution: TrackerSolution;
  classificationStatus: 'PENDING' | 'CLASSIFIED';
  timeToClassify: number;
  classification?: string;
  kind?: 'SENSOR' | 'WEAPON';
  creationTime?: number;
  lastInteractionTime?: number;
  isAutoSolution?: boolean;
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
  designatedTargetId?: string;
  activeTargetId?: string;
  enableRange: number;
  gyroAngle: number;
  distanceTraveled: number;
  isHostile?: boolean;
  history?: EntityHistory[];
}

export interface Transient {
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

export interface ActiveIntercept {
    bearing: number;
    timestamp: number;
    sourceId: string;
}

export interface ScriptedEvent {
  time: number;
  type: 'LOG' | 'DELETE_TRACKER' | 'RESET_ALERT';
  payload: any;
}

export interface GameMetrics {
  minRangeToContact: number;
  counterDetectionTime: number;
  tmaErrorAccumulator: number;
  tmaErrorCount: number;
}

export interface SubmarineState {
  appState: 'MENU' | 'GAME';
  expertMode: boolean;
  godMode: boolean;
  scenarioId: string | null;
  metrics: GameMetrics;

  gameState: 'RUNNING' | 'VICTORY' | 'DEFEAT';

  heading: number;
  speed: number;
  depth: number;
  x: number;
  y: number;
  ownShipHistory: OwnShipHistory[];
  ownshipNoiseLevel: number;
  cavitating: boolean;
  transients: Transient[];
  visualTransients: VisualTransient[];
  activeIntercepts: ActiveIntercept[];
  lastScenarioTick?: number;
  scriptedEvents: ScriptedEvent[];

  fuel: number;
  battery: number;

  contacts: Contact[];

  sensorReadings: SensorReading[];
  logs: { message: string; timestamp: number; type?: 'INFO' | 'ALERT' }[];
  alertLevel: 'NORMAL' | 'COMBAT';
  incomingTorpedoDetected: boolean;

  trackers: Tracker[];
  selectedTrackerId: string | null;
  tubes: Tube[];
  torpedoes: Torpedo[];
  tickCount: number;
  gameTime: number;
  viewScale: ViewScale;
  activeStation: Station;

  orderedHeading: number;
  orderedSpeed: number;
  orderedDepth: number;

  setAppState: (state: 'MENU' | 'GAME') => void;
  setExpertMode: (enabled: boolean) => void;
  toggleGodMode: () => void;
  setOrderedHeading: (heading: number) => void;
  setOrderedSpeed: (speed: number) => void;
  setOrderedDepth: (depth: number) => void;
  addLog: (message: string, type?: 'INFO' | 'ALERT') => void;
  designateTracker: (bearing: number) => void;
  setSelectedTracker: (id: string | null) => void;
  deleteTracker: (id: string) => void;
  updateTrackerSolution: (trackerId: string, solution: Partial<TrackerSolution>) => void;
  addSolutionLeg: (trackerId: string) => void;
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
  loadScenario: (state: Partial<SubmarineState>, id?: string) => void;
  resetSimulation: () => void;
  tick: (delta?: number) => void;
}
