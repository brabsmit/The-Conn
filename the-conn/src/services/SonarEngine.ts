import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../lib/tma';

// Types
type SubmarineState = ReturnType<typeof useSubmarineStore.getState>;

// Constants
const RATE_MED = 1000;
const RATE_SLOW = 6000;
const CHUNK_SIZE = 100;

interface OverlayContext {
    container: PIXI.Container;
    currentChunk: PIXI.Graphics | null;
    pixelCount: number;
    lastPoints: Map<string, number>;
}

class SonarEngine {
    // PIXI Core
    public app: PIXI.Application | null = null;
    private view: HTMLCanvasElement | null = null;
    private width: number = 0;
    private height: number = 0;

    // Persistent History (Buffers)
    private history: { fast: Uint8Array; med: Uint8Array; slow: Uint8Array } | null = null;

    // Persistent Scratch Buffers (Reused per tick to avoid GC)
    private _tempRowBuffer: Uint8Array | null = null;
    private signalLineBuffer: Float32Array | null = null;
    private transientLineBuffer: Float32Array | null = null;
    private processedLineBuffer: Float32Array | null = null;

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
    private solutionOverlay: PIXI.Container | null = null;

    // Overlay Contexts
    private overlayContexts: { fast: OverlayContext; med: OverlayContext; slow: OverlayContext } | null = null;

    // State
    private currentViewScale: 'FAST' | 'MED' | 'SLOW' = 'FAST';
    private showSolution: boolean = true;
    private initialized: boolean = false;

    // Initialization
    public initialize(width: number, height: number): void {
        if (this.initialized && this.app) {
            this.resize(width, height);
            return;
        }

        this.width = width;
        this.height = height;

        // Create PIXI Application
        this.app = new PIXI.Application({
            width,
            height,
            background: 0x001100,
            resolution: (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1,
            autoDensity: true,
        });

        this.view = this.app.view as HTMLCanvasElement;
        this.stage = this.app.stage;

        // Setup Event Mode
        this.stage.eventMode = 'static';
        this.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
        this.stage.on('pointerdown', (e) => this.handlePointerDown(e));

        // Create Containers
        this.sonarContainer = new PIXI.Container();
        this.solutionOverlay = new PIXI.Container();
        this.stage.addChild(this.sonarContainer);
        this.stage.addChild(this.solutionOverlay);

        // Setup Sprite (Placeholder)
        this.sonarSprite = new PIXI.TilingSprite(PIXI.Texture.EMPTY, width, height);
        this.sonarSprite.scale.y = -1;
        this.sonarSprite.y = height;
        this.sonarContainer.addChild(this.sonarSprite);

        // Init Overlay Contexts
        this.overlayContexts = {
            fast: { container: new PIXI.Container(), currentChunk: null, pixelCount: 0, lastPoints: new Map() },
            med: { container: new PIXI.Container(), currentChunk: null, pixelCount: 0, lastPoints: new Map() },
            slow: { container: new PIXI.Container(), currentChunk: null, pixelCount: 0, lastPoints: new Map() }
        };
        this.solutionOverlay.addChild(this.overlayContexts.fast.container);
        this.solutionOverlay.addChild(this.overlayContexts.med.container);
        this.solutionOverlay.addChild(this.overlayContexts.slow.container);

        // Initialize Buffers and Textures
        this.initBuffers(width, height);

        // Start Loop
        this.app.ticker.add((delta) => this.tick(delta));

        this.initialized = true;
    }

    public getView(): HTMLCanvasElement {
        if (!this.view) throw new Error("SonarEngine not initialized");
        return this.view;
    }

    public resize(width: number, height: number): void {
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

        // Re-initialize buffers (clears sonar history)
        this.initBuffers(width, height);

        // Clear overlay history
        if (this.overlayContexts) {
            ['fast', 'med', 'slow'].forEach((key) => {
                const ctx = this.overlayContexts![key as keyof typeof this.overlayContexts];
                ctx.container.removeChildren();
                ctx.currentChunk = null;
                ctx.pixelCount = 0;
                ctx.lastPoints.clear();
                ctx.container.y = 0;
            });
        }
    }

    public setViewScale(scale: 'FAST' | 'MED' | 'SLOW'): void {
        this.currentViewScale = scale;
        this.updateVisibility();
    }

    public setShowSolution(show: boolean): void {
        this.showSolution = show;
        this.updateVisibility();
    }

    public destroy(): void {
        // DO NOT CALL THIS unless you really mean it (e.g. app shutdown)
        // For this task, we persist.
    }

    // --- Internal Logic ---

    private initBuffers(w: number, h: number): void {
        const size = w * h * 4;
        if (size <= 0) return;

        // Reset Scanlines
        this.scanlines = { fast: 0, med: 0, slow: 0 };

        // Allocate History Buffers
        this.history = {
            fast: new Uint8Array(size),
            med: new Uint8Array(size),
            slow: new Uint8Array(size)
        };

        // Allocate Scratch Buffers
        this._tempRowBuffer = new Uint8Array(w * 4);
        this.signalLineBuffer = new Float32Array(w);
        this.transientLineBuffer = new Float32Array(w);
        this.processedLineBuffer = new Float32Array(w);

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

        // Toggle Overlay Containers
        if (this.overlayContexts) {
            this.overlayContexts.fast.container.visible = this.showSolution && this.currentViewScale === 'FAST';
            this.overlayContexts.med.container.visible = this.showSolution && this.currentViewScale === 'MED';
            this.overlayContexts.slow.container.visible = this.showSolution && this.currentViewScale === 'SLOW';
        }

        // Update Sprite Tile Position
        let sl = this.scanlines.fast;
        if (this.currentViewScale === 'MED') sl = this.scanlines.med;
        else if (this.currentViewScale === 'SLOW') sl = this.scanlines.slow;
        this.sonarSprite.tilePosition.y = -sl;
    }

    private handlePointerDown(e: PIXI.FederatedPointerEvent): void {
        if (!this.width) return;

        // Since stage is root and sized to canvas, global is relative to canvas (if canvas is full window or we account for offset).
        // Actually, let's use local to sonarSprite which is (0,0)
        const local = this.stage!.toLocal(e.global);

        const x = local.x;

        // Inverse Mapping: ScreenX -> ViewAngle -> RelativeBearing
        // ScreenX = (viewAngle / 300) * CanvasWidth
        // viewAngle = (ScreenX / CanvasWidth) * 300
        const viewAngle = (x / this.width) * 300;

        let relBearing = 0;

        // If viewAngle <= 150 (Left half), it maps to 210..360
        // If viewAngle > 150 (Right half), it maps to 0..150
        // Wait:
        // 210 -> 0 (viewAngle)
        // 360 -> 150
        // 0 -> 150
        // 150 -> 300

        // Inverse:
        // if viewAngle <= 150: rb = viewAngle + 210
        // if viewAngle > 150: rb = viewAngle - 150

        // Edge case: viewAngle = 150. rb = 360 (0).
        // viewAngle = 150.1 -> rb = 0.1

        if (viewAngle <= 150) {
            relBearing = viewAngle + 210;
        } else {
            relBearing = viewAngle - 150;
        }

        relBearing = normalizeAngle(relBearing);

        useSubmarineStore.getState().designateTracker(relBearing);
    }

    private tick(delta: number): void {
        if (!this.app || !this.history || !this.textures.fast || !this.overlayContexts) return;

        // Time Management
        const deltaMS = this.app.ticker.deltaMS;
        this.accumulators.med += deltaMS;
        this.accumulators.slow += deltaMS;

        const updateMed = this.accumulators.med >= RATE_MED;
        const updateSlow = this.accumulators.slow >= RATE_SLOW;

        if (updateMed) this.accumulators.med -= RATE_MED;
        if (updateSlow) this.accumulators.slow -= RATE_SLOW;

        const state = useSubmarineStore.getState();

        // 1. Generate Sonar Line
        const pixelBuffer = this.generateSonarLine(state);

        // 2. Write to Buffers
        this.writeToBuffer(this.history.fast, this.textures.fast, 'fast', pixelBuffer);
        if (updateMed) this.writeToBuffer(this.history.med, this.textures.med, 'med', pixelBuffer);
        if (updateSlow) this.writeToBuffer(this.history.slow, this.textures.slow, 'slow', pixelBuffer);

        // 3. Update Overlays
        this.processOverlay(this.overlayContexts.fast, state);
        if (updateMed) this.processOverlay(this.overlayContexts.med, state);
        if (updateSlow) this.processOverlay(this.overlayContexts.slow, state);

        // 4. Update Sprite Position
        if (this.sonarSprite) {
            let sl = this.scanlines.fast;
            if (this.currentViewScale === 'MED') sl = this.scanlines.med;
            else if (this.currentViewScale === 'SLOW') sl = this.scanlines.slow;
            this.sonarSprite.tilePosition.y = -sl;
        }
    }

    private generateSonarLine(state: SubmarineState): Uint8Array {
        const { width } = this;

        // Use Pre-allocated Buffers
        if (!this._tempRowBuffer || !this.signalLineBuffer || !this.transientLineBuffer || !this.processedLineBuffer) {
             // Fallback if not init (should not happen)
             this.initBuffers(width, this.height);
        }

        const pixelBuffer = this._tempRowBuffer!;
        // Optimization: Zero-fill not strictly needed for pixelBuffer as we overwrite R,G,B,A for every pixel below.
        // But if needed: pixelBuffer.fill(0);

        const signalBuffer = this.signalLineBuffer!.fill(0); // Reset
        const transientBuffer = this.transientLineBuffer!.fill(0); // Reset
        const processedBuffer = this.processedLineBuffer!; // Will be overwritten

        const { sensorReadings, contacts, torpedoes, visualTransients, x: ownX, y: ownY, heading: ownHeading, ownshipNoiseLevel, gameTime } = state;

        const selfNoisePenalty = ownshipNoiseLevel * 0.5;

        // Helper for Viewport Mapping (300 deg)
        // Mapping: Port (210-360) -> Left, Starboard (0-150) -> Right
        const getScreenX = (relBearing: number): number | null => {
            // Baffles: 150 < rb < 210
            if (relBearing > 150 && relBearing < 210) return null;

            let viewAngle = 0;
            if (relBearing >= 210) {
                viewAngle = relBearing - 210; // 210..360 -> 0..150
            } else {
                viewAngle = relBearing + 150; // 0..150 -> 150..300
            }

            return Math.floor((viewAngle / 300) * width);
        };

        // 1. Contacts
        sensorReadings.forEach((reading) => {
            const contact = contacts.find(c => c.id === reading.contactId);
            if (!contact || contact.status === 'DESTROYED') return;

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

            // Sub-Task 88.3: Scintillation
            signal *= (0.8 + Math.random() * 0.4);

            // reading.bearing is already Relative (0-360) (noisy) from Store
            const rb = normalizeAngle(reading.bearing);
            const cx = getScreenX(rb);

            // Sub-Task 88.1: Gaussian Signal Spread
            if (cx !== null) {
                 const kernel = [0.5, 1.0, 0.5];
                 for (let k = 0; k < 3; k++) {
                     const off = k - 1;
                     const x = cx + off;
                     if (x >= 0 && x < width) {
                         signalBuffer[x] = Math.max(signalBuffer[x], signal * kernel[k]);
                     }
                 }
            }
        });

        // 2. Torpedoes
        torpedoes.forEach((torp) => {
            if (torp.status !== 'RUNNING') return;
            const dx = torp.position.x - ownX;
            const dy = torp.position.y - ownY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const distYards = distance / 3;
            const sourceLevel = 1.2;
            const scaleFactor = 0.0002;
            let signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));

            // Sub-Task 88.3: Scintillation
            signal *= (0.8 + Math.random() * 0.4);

            const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
            const trueBearing = normalizeAngle(90 - mathAngleDeg);
            const relBearing = normalizeAngle(trueBearing - ownHeading);

            const cx = getScreenX(relBearing);

            // Sub-Task 88.1: Gaussian Signal Spread
            if (cx !== null) {
                 const kernel = [0.5, 1.0, 0.5];
                 for (let k = 0; k < 3; k++) {
                     const off = k - 1;
                     const x = cx + off;
                     if (x >= 0 && x < width) {
                         signalBuffer[x] = Math.max(signalBuffer[x], signal * kernel[k]);
                     }
                 }
            }
        });

        // 3. Visual Transients
        visualTransients.forEach(t => {
            const age = gameTime - t.timestamp;
            if (age > 5) return;

            const decay = Math.max(0, 1 - (age / 3.0));
            if (decay <= 0) return;

            // t.bearing is True Bearing
            const relBearing = normalizeAngle(t.bearing - ownHeading);
            const cx = getScreenX(relBearing);

            if (cx !== null) {
                 const spread = 2;
                 for (let off = -spread; off <= spread; off++) {
                     const x = cx + off;
                     if (x >= 0 && x < width) {
                         transientBuffer[x] = Math.max(transientBuffer[x], decay);
                     }
                 }
            }
        });

        // 4. BQQ
        // Copy signalBuffer to processedBuffer
        processedBuffer.set(signalBuffer);

        for (let i = 1; i < width - 1; i++) {
            if (signalBuffer[i] > 0.8) {
                if (signalBuffer[i-1] < 0.8) processedBuffer[i-1] *= 0.1;
                if (signalBuffer[i+1] < 0.8) processedBuffer[i+1] *= 0.1;
            }
        }

        // 5. Render
        for (let i = 0; i < width; i++) {
            // Sub-Task 88.2: The Noise Floor (Dynamic Grain)
            // Generate low-level static noise (0.05 - 0.1)
            const staticNoise = 0.05 + (Math.random() * 0.05);
            // Ownship noise contribution (washout effect)
            const ownshipContribution = ownshipNoiseLevel * 0.15;

            const totalNoise = staticNoise + ownshipContribution;
            const signalVal = processedBuffer[i];

            // Sub-Task 88.4: The Gain Palette (Intensity Mapping)
            // Combine signal and noise
            const totalIntensity = totalNoise + signalVal;

            let r = 0;
            let g = Math.min(255, totalIntensity * 255);
            let b = 0;

            // High Intensity Bloom (White/Yellow-Green)
            // Threshold > 0.8
            if (totalIntensity > 0.8) {
                const bloom = (totalIntensity - 0.8) * 5.0; // Map 0.2 range -> 1.0
                const bloomVal = Math.min(255, bloom * 255);
                r = bloomVal;
                b = bloomVal;
            }

            const transientVal = transientBuffer[i];
            if (transientVal > 0) {
                const white = transientVal * 255;
                r = Math.max(r, white);
                g = Math.max(g, white);
                b = Math.max(b, white);
            }

            pixelBuffer[i * 4 + 0] = r;
            pixelBuffer[i * 4 + 1] = g;
            pixelBuffer[i * 4 + 2] = b;
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

    private processOverlay(ctx: OverlayContext, state: SubmarineState) {
        const { container } = ctx;
        const { trackers, gameTime, x: currX, y: currY, heading: currHeading } = state;
        const { width, height } = this;

        // 1. Scroll
        container.y += 1;
        const localY = -container.y;

        // 2. Manage Chunks
        if (!ctx.currentChunk || ctx.pixelCount >= CHUNK_SIZE) {
            const g = new PIXI.Graphics();
            (g as any).maxLocalY = localY;
            container.addChild(g);
            ctx.currentChunk = g;
            ctx.pixelCount = 0;
        }

        // Pruning
        const oldest = container.children[0] as any;
        if (oldest && oldest.maxLocalY !== undefined) {
             const screenBottomLocal = -container.y + height;
             if ((oldest.maxLocalY - CHUNK_SIZE) > screenBottomLocal + 100) {
                 oldest.destroy();
             }
        }

        ctx.pixelCount++;
        const g = ctx.currentChunk!;

        // 3. Draw
        const ownShip = { x: currX, y: currY, heading: currHeading };
        g.lineStyle(2, 0xffffff, 0.5);

        trackers.forEach((tracker) => {
            if (!tracker.solution) return;
            const targetPos = calculateTargetPosition(tracker.solution, gameTime);
            const dx = targetPos.x - ownShip.x;
            const dy = targetPos.y - ownShip.y;
            let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
            trueBearing = normalizeAngle(trueBearing);

            const relBearing = normalizeAngle(trueBearing - ownShip.heading);

            // Mapping: 210..360..150
            // Baffles: 150 < rb < 210
            if (relBearing > 150 && relBearing < 210) {
                 ctx.lastPoints.delete(tracker.id);
                 return;
            }

            let viewAngle = 0;
            if (relBearing >= 210) {
                viewAngle = relBearing - 210;
            } else {
                viewAngle = relBearing + 150;
            }

            const x = (viewAngle / 300) * width;
            const lastX = ctx.lastPoints.get(tracker.id);
            const isNewChunk = ctx.pixelCount === 1;

            if (lastX !== undefined && !isNewChunk && Math.abs(x - lastX) < 100) {
                g.moveTo(lastX, localY + 1);
                g.lineTo(x, localY);
            } else if (lastX !== undefined && isNewChunk && Math.abs(x - lastX) < 100) {
                g.moveTo(lastX, localY + 1);
                g.lineTo(x, localY);
            } else {
                g.beginFill(0xffffff);
                g.drawRect(x, localY, 1, 1);
                g.endFill();
            }
            ctx.lastPoints.set(tracker.id, x);
        });
    }
}

// Export Singleton
export const sonarEngine = new SonarEngine();
