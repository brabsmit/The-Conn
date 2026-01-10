import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../store/useSubmarineStore';
import { normalizeAngle, calculateTargetPosition } from '../lib/tma';
import { SonarArray } from '../lib/SonarArray';
import { AcousticsEngine } from '../lib/AcousticsEngine';

// Types
type SubmarineState = ReturnType<typeof useSubmarineStore.getState>;

// Constants
const RATE_MED = 1000;
const RATE_SLOW = 6000;
const HEADER_HEIGHT = 40;

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

    // Physics Engine
    private sonarArray: SonarArray;

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
        this.view.addEventListener('webglcontextrestored', () => {
            console.log("WebGL Context Restored - Reinitializing Buffers");
            this.restoreContext();
        });

        // Create Container
        this.sonarContainer = new PIXI.Container();
        this.stage.addChild(this.sonarContainer);

        // Setup Sprite (Placeholder)
        // Task 112.1: The Header Reservation
        // The waterfall lives in (0, HEADER_HEIGHT, width, height - HEADER_HEIGHT)
        this.sonarSprite = new PIXI.TilingSprite(PIXI.Texture.EMPTY, width, height - HEADER_HEIGHT);
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
        this.sonarArray = new SonarArray(360, 2.0);
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
            this.sonarSprite.height = height - HEADER_HEIGHT;
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

    private tick(_delta: number): void {
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

        // Task 114.1: The Header Wipe (Strict Redraw)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, 40); // Explicit 40px

        // Task 114.1: Bottom Border
        ctx.strokeStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(width, 40);
        ctx.stroke();

        // Task 112.2: The Compass Scale (Header Context)
        ctx.fillStyle = '#008888'; // Dark Cyan
        ctx.strokeStyle = '#005500';
        ctx.lineWidth = 1;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let b = 0; b < 360; b += 30) {
            const x = this.mapBearingToX(b);
            if (x !== null && isFinite(x)) {
                // Tick
                ctx.beginPath();
                ctx.moveTo(x, HEADER_HEIGHT - 5);
                ctx.lineTo(x, HEADER_HEIGHT);
                ctx.stroke();

                // Number
                const label = b.toString().padStart(3, '0');
                ctx.fillText(label, x, 15);
            }
        }

        // Render Trackers
        trackers.forEach(t => {
            const x = this.mapBearingToX(t.currentBearing);

            // Sub-Task 96.3: The Data Sanity Check (The "NaN" Hunter)
            if (x === null || !isFinite(x)) return;

            // Visual Distinction for Selected/Weapon
            let color = '#005500';
            let textColor = '#FFFFFF'; // Default White for Visibility
            let lineWidth = 1;

            if (t.kind === 'WEAPON') {
                color = '#FFFF00'; // Yellow
                textColor = '#FFFF00';
                lineWidth = 2;
            } else if (t.id === selectedTrackerId) {
                color = '#00FF00'; // Bright Green
                textColor = '#00FFFF'; // Cyan for Selected Text
                lineWidth = 2;
            }

            // Task 112.3: The "Short Tick" Fix
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;

            // Short tick pointing into waterfall
            ctx.moveTo(x, 38);
            ctx.lineTo(x, 50);
            ctx.stroke();

            // Label
            ctx.fillStyle = textColor;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(t.id, x, 35);
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
        // Task 111.2: The Color Gradient (Visual Tuning)
        // Palette:
        // 0.0 - 0.2: Dark Noise (#003300)
        // 0.2 - 0.6: Signal Green (#00CC00)
        // 0.6 - 0.9: High Intensity (#AAFF00)
        // 0.9 - 1.0: Saturation (#FFFFFF)

        let r = 0, g = 0, b = 0;

        if (value < 0.2) {
            // 0.0 -> 0.2 (0,0,0 -> 0,51,0)
            const t = value / 0.2;
            r = 0;
            g = 51 * t; // 0x33 = 51
            b = 0;
        } else if (value < 0.6) {
            // 0.2 -> 0.6 (0,51,0 -> 0,204,0)
            const t = (value - 0.2) / 0.4;
            r = 0;
            g = 51 + (153 * t); // 204 - 51 = 153. 0xCC = 204
            b = 0;
        } else if (value < 0.9) {
            // 0.6 -> 0.9 (0,204,0 -> 170,255,0)
            const t = (value - 0.6) / 0.3;
            r = 170 * t; // 0xAA = 170
            g = 204 + (51 * t); // 255 - 204 = 51
            b = 0;
        } else {
            // 0.9 -> 1.0 (170,255,0 -> 255,255,255)
            const t = (value - 0.9) / 0.1;
            r = 170 + (85 * t); // 255 - 170 = 85
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

    private mapXToBearing(x: number): number {
        // Inverse of mapBearingToX
        // viewAngle = (x / width) * 300
        const viewAngle = (x / this.width) * 300;

        if (viewAngle < 150) {
            // Left Side (210 -> 360)
            return 210 + viewAngle;
        } else {
            // Right Side (0 -> 150)
            return viewAngle - 150;
        }
    }

    private generateSonarLine(state: SubmarineState): Uint8Array {
        const { width } = this;

        // Use Pre-allocated Buffers
        if (!this._tempRowBuffer) {
             this.initBuffers(width, this.height);
        }

        const pixelBuffer = this._tempRowBuffer!;

        const { contacts, torpedoes, visualTransients, x: ownX, y: ownY, heading: ownHeading, speed: ownSpeed, gameTime } = state;

        // 1. Reset Physics Array (Noise Floor)
        // Task 113.1: The Noise Manager (NL = AN + SN)
        // We assume Sea State 3 and Deep Water for now (Standard Atlantic)
        const seaState = 3;
        const deepWater = true;

        // Task 116.2: Logic - use AcousticsEngine to get the global noise floor
        const currentNoiseFloor = AcousticsEngine.calculateNoiseLevel(Math.abs(ownSpeed), seaState);
        this.sonarArray.clear(currentNoiseFloor);

        // 2. Process Contacts (Physics Integration)
        contacts.forEach((contact) => {
            if (contact.status === 'DESTROYED') return;

            // Physics Stats
            const baseSL = 120; // 120dB reference for "Standard Contact"
            let slModifier = (contact.sourceLevel || 1.0) * 10; // +10dB for loud

            // Cavitation
            const cavitationSpeed = contact.cavitationSpeed || 100;
            if (contact.speed !== undefined && contact.speed > cavitationSpeed) {
                slModifier += 15; // +15dB for cavitation
            }

            const sourceLevel = baseSL + slModifier;

            // Transmission Loss
            const dx = contact.x - ownX;
            const dy = contact.y - ownY;
            const distYards = Math.max(1, Math.sqrt(dx * dx + dy * dy) / 3);
            
            // Task 113.2: The Transmission Loss Model (TL)
            const tl = AcousticsEngine.calculateTransmissionLoss(distYards, deepWater);
            const rl = sourceLevel - tl;

            // Geometry
            const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
            const trueBearing = normalizeAngle(90 - mathAngleDeg);
            const relBearing = normalizeAngle(trueBearing - ownHeading);

            // Baffles Check (Physics: Array is blocked by hull)
            // But we simulate it by just not adding signal if deep in baffles?
            // Or reduced signal? "Reduced passive detection range" implies attenuation.
            // Let's attenuate by 20dB in baffles.
            let signal = rl;
            if (relBearing > 150 && relBearing < 210) {
                signal -= 20;
            }

            // Integrate
            // Task 116.3: Verified Sinc Addition (Linear Power Addition)
            this.sonarArray.addSignal(relBearing, signal);
        });

        // 3. Torpedoes (Loud!)
        torpedoes.forEach((torp) => {
            if (torp.status !== 'RUNNING') return;

            const sourceLevel = 140; // Very loud

            const dx = torp.position.x - ownX;
            const dy = torp.position.y - ownY;
            const distYards = Math.max(1, Math.sqrt(dx * dx + dy * dy) / 3);

            // Task 113.2: The Transmission Loss Model (TL)
            const tl = AcousticsEngine.calculateTransmissionLoss(distYards, deepWater);
            const rl = sourceLevel - tl;

            const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
            const trueBearing = normalizeAngle(90 - mathAngleDeg);
            const relBearing = normalizeAngle(trueBearing - ownHeading);

            this.sonarArray.addSignal(relBearing, rl);
        });

        // 4. Render (Scanline)
        for (let i = 0; i < width; i++) {
            // Map X -> Bearing
            const bearing = this.mapXToBearing(i);
            
            // Sample Array (Interpolated dB)
            let db = this.sonarArray.getDb(bearing);
            
            // Map dB to Color (Dynamic Range 50dB .. 90dB)
            // Normalize 0..1

            // Task 116.1 & 116.2: Dynamic Gain Recalibration (The "Exposure" Fix)
            // Shift the Dynamic Window and Implement "Gain Knob" (Auto-Gain Control)
            // Use the calculated Noise Level (currentNoiseFloor) as the baseline for the floor.
            const renderFloor = currentNoiseFloor - 2.0; // Keep noise barely visible
            const renderCeiling = renderFloor + 30.0; // 30dB Dynamic Range

            let val = (db - renderFloor) / (renderCeiling - renderFloor);
            
            // Visual Transients (Override)
            // These are strictly visual overlay effects, not acoustic physics
            // We can just add them to intensity for now
            visualTransients.forEach(t => {
                const age = gameTime - t.timestamp;
                if (age > 5) return;
                const decay = Math.max(0, 1 - (age / 3.0));

                const tBearing = normalizeAngle(t.bearing - ownHeading);
                const diff = Math.abs(tBearing - bearing);
                // Simple 2 degree visual width
                if (diff < 2 || diff > 358) {
                    val += decay;
                }
            });

            val = Math.max(0, Math.min(1, val));
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
