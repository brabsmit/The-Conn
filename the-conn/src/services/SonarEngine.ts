import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../store/useSubmarineStore';
import { normalizeAngle, calculateTargetPosition } from '../lib/tma';

// Types
type SubmarineState = ReturnType<typeof useSubmarineStore.getState>;

// Signature Profiles
const SIGNATURES = {
    MERCHANT: { width: 3, stability: 1.0, hash: 0.8, gain: 1.2 },
    BIOLOGICAL: { width: 1, stability: 0.4, hash: 0.2, gain: 0.8 },
    WARSHIP: { width: 2, stability: 0.9, hash: 0.5, gain: 1.0 },
    SUB: { width: 0, stability: 0.95, hash: 0.0, gain: 0.6 },
    TORPEDO: { width: 1, stability: 1.0, hash: 0.1, gain: 1.2 },
    TRAWLER: { width: 4, stability: 0.7, hash: 0.9, gain: 1.3 },
    UNKNOWN: { width: 1, stability: 0.8, hash: 0.3, gain: 1.0 }
};

const PROFILE_MAP: Record<string, keyof typeof SIGNATURES> = {
    'MERCHANT': 'MERCHANT',
    'ESCORT': 'WARSHIP',
    'SUB': 'SUB',
    'BIOLOGICAL': 'BIOLOGICAL',
    'TRAWLER': 'TRAWLER'
};

// Constants
const RATE_MED = 1000;
const RATE_SLOW = 6000;

// Task 99.2: Shader Definition
const WASHOUT_FRAG = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uContactBearings[16];
uniform float uContactCount;

void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);

    float bloom = 0.0;

    // Task 102.1: Shader Exorcism - Disable GPU Bloom
    // for (int i = 0; i < 16; i++) {
    //     if (uContactBearings[i] < -1.0) continue; // Sentinel Check (Fix 101.1)
    //     if (i >= int(uContactCount)) break;

    //     float bearingX = uContactBearings[i];

    //     // Check for valid bearing (0.0 - 1.0)
    //     if (bearingX >= 0.0 && bearingX <= 1.0) {
    //         float dist = abs(vTextureCoord.x - bearingX);

    //         // Washout Width (~1% of screen)
    //         if (dist < 0.01) {
    //             float intensity = 1.0 - (dist / 0.01);
    //             bloom += intensity * 0.3; // Additive bloom
    //         }
    //     }
    // }

    // Apply bloom to all channels for a white-out effect
    gl_FragColor = color + vec4(bloom, bloom, bloom, 0.0);
}
`;

export class SonarEngine {
    // PIXI Core
    public app: PIXI.Application | null = null;
    private view: HTMLCanvasElement | null = null;
    private width: number = 0;
    private height: number = 0;

    // 2D Overlay Core
    private overlayCtx: CanvasRenderingContext2D | null = null;

    // Persistent History (Buffers)
    private history: { fast: Uint8Array; med: Uint8Array; slow: Uint8Array } | null = null;

    // Persistent Scratch Buffers (Reused per tick to avoid GC)
    private _tempRowBuffer: Uint8Array | null = null;
    private signalLineBuffer: Float32Array | null = null;
    private transientLineBuffer: Float32Array | null = null;
    private processedLineBuffer: Float32Array | null = null;
    private lastFrameBuffer: Float32Array | null = null;

    // Textures
    private textures: { fast: PIXI.Texture | null; med: PIXI.Texture | null; slow: PIXI.Texture | null } = {
        fast: null, med: null, slow: null
    };

    // Scanlines (Current Write Position)
    private scanlines: { fast: number; med: number; slow: number } = { fast: 0, med: 0, slow: 0 };

    // Update Accumulators
    private accumulators: { med: number; slow: number } = { med: 0, slow: 0 };

    // Scene Graph
    private stage: PIXI.Container | null = null;
    private sonarContainer: PIXI.Container | null = null;
    private sonarSprite: PIXI.TilingSprite | null = null;

    // Task 99.2: Shader Filter
    private washoutFilter: PIXI.Filter | null = null;

    // State
    private currentViewScale: 'FAST' | 'MED' | 'SLOW' = 'FAST';
    private initialized: boolean = false;
    private showSolutions: boolean = false; // Task 101.2: State for Solution Overlay

    // Initialization
    public initialize(container: HTMLElement, overlayCanvas: HTMLCanvasElement, width: number, height: number): void {
        if (this.initialized && this.app) {
            this.resize(width, height);
            return;
        }

        this.width = width;
        this.height = height;

        // Setup 2D Overlay Context
        this.overlayCtx = overlayCanvas.getContext('2d');

        // Create PIXI Application (Waterfall Layer)
        this.app = new PIXI.Application({
            width,
            height,
            background: 0x001100,
            resolution: (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1,
            autoDensity: true,
            resizeTo: container
        });

        this.view = this.app.view as HTMLCanvasElement;
        container.appendChild(this.view); // Append WebGL canvas to its container

        this.stage = this.app.stage;

        // Setup Event Mode
        this.stage.eventMode = 'static';
        this.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);

        // Handle Context Loss
        this.view.addEventListener('webglcontextlost', (event) => {
            console.error("FATAL: WebGL Context Lost!", event);
            event.preventDefault();
        });

        // Task 99.3: Context Restoration
        this.view.addEventListener('webglcontextrestored', (event) => {
            console.log("WebGL Context Restored - Reinitializing Buffers");
            this.restoreContext();
        });

        // Create Container
        this.sonarContainer = new PIXI.Container();
        this.stage.addChild(this.sonarContainer);

        // Setup Sprite (Placeholder)
        this.sonarSprite = new PIXI.TilingSprite(PIXI.Texture.EMPTY, width, height);
        this.sonarSprite.scale.y = -1;
        this.sonarSprite.y = height;

        // Task 99.2: Apply Shader
        this.washoutFilter = new PIXI.Filter(undefined, WASHOUT_FRAG, {
            uContactBearings: new Float32Array(16).fill(-999.0),
            uContactCount: 0.0
        });
        this.sonarSprite.filters = [this.washoutFilter];

        this.sonarContainer.addChild(this.sonarSprite);

        // Initialize Buffers and Textures
        this.initBuffers(width, height);

        // Start Loop
        this.app.ticker.add((delta) => this.tick(delta));

        this.initialized = true;
    }

    // Constructor Adapter
    constructor(container: HTMLElement, overlayCanvas: HTMLCanvasElement, width: number, height: number) {
        this.initialize(container, overlayCanvas, width, height);
    }

    // Task 99.3: Restore Context Logic
    private restoreContext() {
        if (!this.width || !this.height) return;

        // Re-initialize buffers but PRESERVE history content
        this.initBuffers(this.width, this.height, true);

        // Re-apply filter just in case
        if (this.sonarSprite && this.washoutFilter) {
            this.sonarSprite.filters = [this.washoutFilter];
        }
    }

    public resize(width: number, height: number): void {
        // Safe-guard against redundant resizes
        if (!this.app || (this.width === width && this.height === height)) return;

        this.width = width;
        this.height = height;
        this.app.renderer.resize(width, height);
        if (this.stage) this.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);

        if (this.sonarSprite) {
            this.sonarSprite.width = width;
            this.sonarSprite.height = height;
            this.sonarSprite.y = height;
        }

        // Re-initialize buffers (clears sonar history on resize)
        this.initBuffers(width, height, false);
    }

    public setViewScale(scale: 'FAST' | 'MED' | 'SLOW'): void {
        this.currentViewScale = scale;
        this.updateVisibility();
    }

    public setShowSolutions(show: boolean): void {
        this.showSolutions = show;
    }

    public destroy(): void {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: true, baseTexture: true });
            this.app = null;
        }
        this.overlayCtx = null;
    }

    // --- Internal Logic ---

    private initBuffers(w: number, h: number, preserveHistory: boolean = false): void {
        const size = w * h * 4;
        if (size <= 0) return;

        // Reset Scanlines if not preserving
        if (!preserveHistory) {
             this.scanlines = { fast: 0, med: 0, slow: 0 };
        }

        // Allocate History Buffers
        if (!this.history || this.history.fast.length !== size) {
            // If size changed or not active, we must re-allocate (cannot preserve)
            this.history = {
                fast: new Uint8Array(size),
                med: new Uint8Array(size),
                slow: new Uint8Array(size)
            };
            // Force reset scanlines if size changed
            this.scanlines = { fast: 0, med: 0, slow: 0 };
        }
        // Else: If preserveHistory is true AND size matches, we do NOT overwrite this.history
        // We simply create new textures pointing to the EXISTING buffers.

        // Allocate Scratch Buffers
        this._tempRowBuffer = new Uint8Array(w * 4);
        this.signalLineBuffer = new Float32Array(w);
        this.transientLineBuffer = new Float32Array(w);
        this.processedLineBuffer = new Float32Array(w);
        this.lastFrameBuffer = new Float32Array(w);

        // Clean up old textures
        if (this.textures.fast) this.textures.fast.destroy(true);
        if (this.textures.med) this.textures.med.destroy(true);
        if (this.textures.slow) this.textures.slow.destroy(true);

        // Create new textures
        const opts = { width: w, height: h, wrapMode: PIXI.WRAP_MODES.REPEAT };
        this.textures = {
            fast: PIXI.Texture.fromBuffer(this.history.fast, w, h, opts),
            med: PIXI.Texture.fromBuffer(this.history.med, w, h, opts),
            slow: PIXI.Texture.fromBuffer(this.history.slow, w, h, opts)
        };

        this.updateVisibility();
    }

    private updateVisibility(): void {
        if (!this.sonarSprite || !this.textures.fast) return;

        // Set Active Texture
        if (this.currentViewScale === 'FAST') this.sonarSprite.texture = this.textures.fast || PIXI.Texture.EMPTY;
        else if (this.currentViewScale === 'MED') this.sonarSprite.texture = this.textures.med || PIXI.Texture.EMPTY;
        else this.sonarSprite.texture = this.textures.slow || PIXI.Texture.EMPTY;

        // Update Sprite Tile Position
        let sl = this.scanlines.fast;
        if (this.currentViewScale === 'MED') sl = this.scanlines.med;
        else if (this.currentViewScale === 'SLOW') sl = this.scanlines.slow;
        this.sonarSprite.tilePosition.y = -sl;
    }

    private tick(delta: number): void {
        if (!this.app || !this.history || !this.textures.fast) return;

        // Time Management
        const deltaMS = this.app.ticker.deltaMS;
        this.accumulators.med += deltaMS;
        this.accumulators.slow += deltaMS;

        const updateMed = this.accumulators.med >= RATE_MED;
        const updateSlow = this.accumulators.slow >= RATE_SLOW;

        if (updateMed) this.accumulators.med -= RATE_MED;
        if (updateSlow) this.accumulators.slow -= RATE_SLOW;

        const state = useSubmarineStore.getState();

        // 0. Sync View Scale from Store
        if (state.viewScale !== this.currentViewScale) {
            this.setViewScale(state.viewScale);
        }

        // 1. Generate Sonar Line
        const pixelBuffer = this.generateSonarLine(state);

        // 2. Write to Buffers
        this.writeToBuffer(this.history.fast, this.textures.fast, 'fast', pixelBuffer);
        if (updateMed) this.writeToBuffer(this.history.med, this.textures.med, 'med', pixelBuffer);
        if (updateSlow) this.writeToBuffer(this.history.slow, this.textures.slow, 'slow', pixelBuffer);

        // 3. Update 2D Overlays (The "Ironclad" Separation)
        this.renderOverlays(state);

        // 4. Update Shader Uniforms (Task 99.2)
        if (this.washoutFilter) {
            // Paranoid Shader Data: Fixed Buffer
            const uniformData = new Float32Array(16).fill(-999.0); // Default off-screen
            let count = 0;

            state.sensorReadings.forEach(reading => {
                if (count >= 16) return;

                // Only process active contacts? Or all sensors?
                // Using all sensor readings.

                const rb = normalizeAngle(reading.bearing);
                const cx = this.mapBearingToX(rb); // Returns pixel X (0..width) or null

                if (cx !== null && isFinite(cx)) {
                     // Normalize to UV space (0..1)
                     uniformData[count] = cx / this.width;
                     count++;
                }
            });

            // Upload to Shader
            this.washoutFilter.uniforms.uContactBearings = uniformData;
            this.washoutFilter.uniforms.uContactCount = count;
        }

        // 5. Update Sprite Position
        if (this.sonarSprite) {
            let sl = this.scanlines.fast;
            if (this.currentViewScale === 'MED') sl = this.scanlines.med;
            else if (this.currentViewScale === 'SLOW') sl = this.scanlines.slow;
            this.sonarSprite.tilePosition.y = -sl;
        }
    }

    private renderOverlays(state: SubmarineState): void {
        const ctx = this.overlayCtx;
        if (!ctx) return;

        const { width, height } = this;
        const { trackers, selectedTrackerId } = state;

        // Wipe the glass
        ctx.clearRect(0, 0, width, height);

        // Render Current Bearing Lines
        trackers.forEach(t => {
            const x = this.mapBearingToX(t.currentBearing);

            // Sub-Task 96.3: The Data Sanity Check (The "NaN" Hunter)
            if (x === null || !isFinite(x)) return;

            // Draw line using standard 2D API
            ctx.beginPath();

            // Visual Distinction for Selected/Weapon
            if (t.kind === 'WEAPON') {
                ctx.strokeStyle = '#FFFF00'; // Yellow for Weapons
                ctx.lineWidth = 2;
            } else if (t.id === selectedTrackerId) {
                ctx.strokeStyle = '#00FF00'; // Bright Green for Selected
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#005500'; // Dim Green for others
                ctx.lineWidth = 1;
            }

            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        });

        // Task 101.3: Render Solution Curves
        if (this.showSolutions) {
            this.renderSolutionCurves(state);
        }
    }

    private renderSolutionCurves(state: SubmarineState): void {
        const { height } = this;
        const ctx = this.overlayCtx;
        if (!ctx) return;

        const msPerPixel = this.getMsPerPixel();
        const currentTime = state.gameTime;
        const history = state.ownShipHistory;

        if (history.length < 2) return;

        // Iterate Trackers
        state.trackers.forEach(tracker => {
            // Skip weapons for user solution overlay
            if (tracker.kind === 'WEAPON') return;

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;

            let firstPoint = true;
            let hIdx = history.length - 1; // Optimization: Search backwards

            for (let y = 0; y < height; y += 10) { // Step 10px for performance
                 const timeAtRow = currentTime - (y * msPerPixel / 1000); // seconds

                 // Find OwnShip at timeAtRow (Searching backwards from hIdx)
                 while(hIdx > 0 && history[hIdx].time > timeAtRow) {
                     hIdx--;
                 }

                 // Get Interpolated OwnShip State
                 const p1 = history[hIdx];
                 const p2 = history[hIdx+1]; // Might be undefined if hIdx is last

                 let ownX = p1.x;
                 let ownY = p1.y;
                 let ownHeading = p1.heading;

                 if (p2) {
                     const total = p2.time - p1.time;
                     if (total > 0) {
                         const curr = timeAtRow - p1.time;
                         const t = Math.max(0, Math.min(1, curr / total));
                         ownX = p1.x + (p2.x - p1.x) * t;
                         ownY = p1.y + (p2.y - p1.y) * t;
                         // Simple heading lerp
                         ownHeading = p1.heading + (p2.heading - p1.heading) * t;
                     }
                 }

                 // Calculate Solution Target Position (DR from anchor)
                 const targetPos = calculateTargetPosition(tracker.solution, timeAtRow);

                 // Bearing Own -> Target
                 const dx = targetPos.x - ownX;
                 const dy = targetPos.y - ownY;
                 const trueBearing = normalizeAngle(Math.atan2(dx, dy) * (180 / Math.PI));
                 const relBearing = normalizeAngle(trueBearing - ownHeading);

                 const x = this.mapBearingToX(relBearing);

                 if (x !== null && isFinite(x)) {
                     if (firstPoint) {
                         ctx.moveTo(x, y);
                         firstPoint = false;
                     } else {
                         // Check for large jumps (wrap-around or baffle clip)
                         // We assume continuous within view except baffles
                         ctx.lineTo(x, y);
                     }
                 } else {
                     firstPoint = true; // Break line
                 }
            }
            ctx.stroke();
        });
    }

    private getMsPerPixel(): number {
         if (this.currentViewScale === 'FAST') return 1000 / 60; // Approx 16.6ms
         if (this.currentViewScale === 'MED') return 1000;
         if (this.currentViewScale === 'SLOW') return 6000;
         return 1000;
    }

    private getColor(value: number): { r: number, g: number, b: number } {
        // Palette:
        // 0.0 - 0.3: Dark Green (Background/Noise)
        // 0.3 - 0.7: Bright Green (Faint Contact)
        // 0.7 - 0.9: Yellow/Light Green (Strong Contact)
        // 0.9 - 1.0: White (Transient/Active Ping)

        let r = 0, g = 0, b = 0;

        if (value < 0.3) {
            // 0.0 -> 0.3 (0,20,0 -> 0,60,0)
            const t = value / 0.3;
            r = 0;
            g = 20 + (40 * t);
            b = 0;
        } else if (value < 0.7) {
            // 0.3 -> 0.7 (0,60,0 -> 0,255,0)
            const t = (value - 0.3) / 0.4;
            r = 0;
            g = 60 + (195 * t);
            b = 0;
        } else if (value < 0.9) {
            // 0.7 -> 0.9 (0,255,0 -> 200,255,0)
            const t = (value - 0.7) / 0.2;
            r = 200 * t;
            g = 255;
            b = 0;
        } else {
            // 0.9 -> 1.0+ (200,255,0 -> 255,255,255)
            const t = Math.min(1.0, (value - 0.9) / 0.1);
            r = 200 + (55 * t);
            g = 255;
            b = 255 * t;
        }

        return { r: Math.floor(r), g: Math.floor(g), b: Math.floor(b) };
    }

    private mapBearingToX(relBearing: number): number | null {
        // Baffles: 150 < rb < 210
        if (relBearing > 150 && relBearing < 210) return null;

        let viewAngle = 0;
        if (relBearing >= 210) {
            viewAngle = relBearing - 210; // 210..360 -> 0..150
        } else {
            viewAngle = relBearing + 150; // 0..150 -> 150..300
        }

        return Math.floor((viewAngle / 300) * this.width);
    }

    private generateSonarLine(state: SubmarineState): Uint8Array {
        const { width } = this;

        // Use Pre-allocated Buffers
        if (!this._tempRowBuffer || !this.signalLineBuffer || !this.transientLineBuffer || !this.processedLineBuffer) {
             this.initBuffers(width, this.height);
        }

        const pixelBuffer = this._tempRowBuffer!;

        const signalBuffer = this.signalLineBuffer!.fill(0); // Reset
        const transientBuffer = this.transientLineBuffer!.fill(0); // Reset
        const processedBuffer = this.processedLineBuffer!; // Will be overwritten
        
        // Ensure lastFrameBuffer exists
        if (!this.lastFrameBuffer) this.lastFrameBuffer = new Float32Array(width);
        const lastFrameBuffer = this.lastFrameBuffer;

        const { sensorReadings, contacts, torpedoes, visualTransients, x: ownX, y: ownY, heading: ownHeading, ownshipNoiseLevel, gameTime } = state;

        const selfNoisePenalty = ownshipNoiseLevel * 0.5;

        // 1. Phase 1: Raw Signals (Peak Gathering)
        sensorReadings.forEach((reading) => {
            const contact = contacts.find(c => c.id === reading.contactId);
            if (!contact || contact.status === 'DESTROYED') return;

            const profileKey = PROFILE_MAP[contact.classification || 'UNKNOWN'] || 'UNKNOWN';
            const profile = SIGNATURES[profileKey] || SIGNATURES.UNKNOWN;

            if (Math.random() > profile.stability) return;

            let sourceLevel = contact.sourceLevel || 1.0;
            const cavitationSpeed = contact.cavitationSpeed || 100;
            if (contact.speed !== undefined && contact.speed > cavitationSpeed) {
                sourceLevel += 0.5;
            }

            const dx = contact.x - ownX;
            const dy = contact.y - ownY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const distYards = distance / 3;

            const scaleFactor = 0.0002;
            let signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));
            signal = Math.max(0, signal - selfNoisePenalty);

            // Scintillation
            signal *= profile.gain;
            signal *= (0.8 + Math.random() * 0.4);

            if (contact.classification === 'TRAWLER') {
                if (Math.random() < 0.0005) { 
                    signal += 0.8;
                }
            }
            
            // Apply Hash to the raw peak (simulating internal noise before spreading)
            const noise = 1.0 - (profile.hash * 0.5) + (Math.random() * profile.hash);
            signal *= noise;

            const rb = normalizeAngle(reading.bearing);
            const cx = this.mapBearingToX(rb);

            if (cx !== null && cx >= 0 && cx < width) {
                signalBuffer[cx] = Math.max(signalBuffer[cx], signal);
            }
        });

        // 2. Torpedoes (Raw)
        torpedoes.forEach((torp) => {
            if (torp.status !== 'RUNNING') return;

            const profile = SIGNATURES.TORPEDO;

            const dx = torp.position.x - ownX;
            const dy = torp.position.y - ownY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const distYards = distance / 3;
            const sourceLevel = 1.2;
            const scaleFactor = 0.0002;
            let signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));

            signal *= profile.gain;
            signal *= (0.8 + Math.random() * 0.4);

            const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
            const trueBearing = normalizeAngle(90 - mathAngleDeg);
            const relBearing = normalizeAngle(trueBearing - ownHeading);

            const cx = this.mapBearingToX(relBearing);

            if (cx !== null && cx >= 0 && cx < width) {
                signalBuffer[cx] = Math.max(signalBuffer[cx], signal);
            }
        });

        // 3. Visual Transients (Raw)
        visualTransients.forEach(t => {
            const age = gameTime - t.timestamp;
            if (age > 5) return;

            const decay = Math.max(0, 1 - (age / 3.0));
            if (decay <= 0) return;

            const relBearing = normalizeAngle(t.bearing - ownHeading);
            const cx = this.mapBearingToX(relBearing);

            if (cx !== null && cx >= 0 && cx < width) {
                transientBuffer[cx] = Math.max(transientBuffer[cx], decay);
            }
        });

        // 4. Phase 2: Convolution (First Null Kernel)
        // Kernel: [-0.3, 0.2, 1.0, 0.2, -0.3]
        for (let i = 0; i < width; i++) {
            let sum = 0;
            // Center
            sum += signalBuffer[i] * 1.0;
            
            // Neighbors (+/- 1) -> 0.2
            if (i > 0) sum += signalBuffer[i - 1] * 0.2;
            if (i < width - 1) sum += signalBuffer[i + 1] * 0.2;
            
            // Neighbors (+/- 2) -> -0.3 (The Black Band)
            if (i > 1) sum += signalBuffer[i - 2] * -0.3;
            if (i < width - 2) sum += signalBuffer[i + 2] * -0.3;

            // Clamp? Or allow negative to carve noise? 
            // Logic: "Subtracts from the noise". So we allow negative values here.
            processedBuffer[i] = sum;
        }
        
        // 5. Phase 3: Temporal Smoothing (De-Flicker)
        // Logic: RenderStrength = (Current * 0.3) + (Last * 0.7)
        for (let i = 0; i < width; i++) {
            const current = processedBuffer[i];
            const last = lastFrameBuffer[i];
            const smoothed = (current * 0.3) + (last * 0.7);
            
            lastFrameBuffer[i] = smoothed; // Update history
            processedBuffer[i] = smoothed; // Update for render
        }

        // 6. Phase 4: Composition & Render (Gain Map)
        for (let i = 0; i < width; i++) {
            // Noise Floor (The Ocean Layer)
            const staticNoise = (Math.random() * 0.1); 
            const noiseFloor = 0.15;
            const baseNoise = noiseFloor + staticNoise;
            
            // Ownship Noise penalty/washout
            const ownshipContribution = ownshipNoiseLevel * 0.15;
            
            // Combine: Noise + Signal (Signal can be negative due to kernel)
            // "pixelValue = Math.max(0, currentNoise + (signalStrength * kernelValue))"
            // processedBuffer[i] contains the convolved signal (positive peak, negative bands)
            
            let val = baseNoise + ownshipContribution + processedBuffer[i];
            val = Math.max(0, val); // Clip negative

            // Add transients (pure white overlay, no smoothing/kernels usually, or treated separately)
            // If we treat them as just additive light:
            val += transientBuffer[i];

            const color = this.getColor(val);

            pixelBuffer[i * 4 + 0] = color.r;
            pixelBuffer[i * 4 + 1] = color.g;
            pixelBuffer[i * 4 + 2] = color.b;
            pixelBuffer[i * 4 + 3] = 255;
        }

        return pixelBuffer;
    }

    private writeToBuffer(buffer: Uint8Array, tex: PIXI.Texture | null, speed: 'fast'|'med'|'slow', pixelBuffer: Uint8Array) {
        if (!tex || !tex.baseTexture || tex.baseTexture.destroyed || !tex.valid) return;

        const scanline = this.scanlines[speed];
        const offset = scanline * this.width * 4;

        if (offset + pixelBuffer.length <= buffer.length) {
            buffer.set(pixelBuffer, offset);
            tex.update();
        }

        this.scanlines[speed] = (scanline + 1) % this.height;
    }
}
