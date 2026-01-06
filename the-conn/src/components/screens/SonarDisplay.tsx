import { useRef, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Container, Sprite, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { SonarSweepFilter } from './SonarShader';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { ViewScale } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { useInterval } from '../../hooks/useInterval';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';

// Types for data passing (Decoupled from store implementation)
type SubmarineState = ReturnType<typeof useSubmarineStore.getState>;

// Update Rates
const RATE_MED = 1000; // 1 second
const RATE_SLOW = 6000; // 6 seconds

interface DimensionProps {
    width: number;
    height: number;
}

interface WaterfallRef {
    processTick: (state: SubmarineState, updateMed: boolean, updateSlow: boolean) => void;
    getCurrentScanline: () => number;
}

interface WaterfallProps extends DimensionProps {
    viewScale: ViewScale;
}

// Define Texture State Type
interface TexturesState {
    fast: PIXI.Texture | null;
    med: PIXI.Texture | null;
    slow: PIXI.Texture | null;
}

const Waterfall = forwardRef<WaterfallRef, WaterfallProps>(({ width, height, viewScale }, ref) => {
    // The persistent memory
    const historyRef = useRef<{
        fast: Uint8Array,
        med: Uint8Array,
        slow: Uint8Array
    } | null>(null);

    // Textures State (for display)
    const [textures, setTextures] = useState<TexturesState>({ fast: null, med: null, slow: null });

    // Textures Ref (for cleanup only)
    const texturesRef = useRef<TexturesState | null>(null);

    // Indices for each buffer
    const scanlineFastRef = useRef(0);
    const scanlineMedRef = useRef(0);
    const scanlineSlowRef = useRef(0);

    // Initialize history buffers ONCE
    useEffect(() => {
        if (!historyRef.current) {
            // Initialize with current dimensions.
            // Note: If width/height are 0 initially, we handle resize in the next effect.
            const size = width * height * 4;
            // Ensure non-zero size if possible, or allow 0 and resize later.

             historyRef.current = {
                fast: new Uint8Array(Math.max(0, size)),
                med: new Uint8Array(Math.max(0, size)),
                slow: new Uint8Array(Math.max(0, size))
            };
        }
    }, []); // STRICTLY EMPTY DEPENDENCIES

    // Handle Resize and Texture Management
    useEffect(() => {
        if (!historyRef.current) return;

        const size = width * height * 4;
        if (size <= 0) return;

        let newFast: PIXI.Texture;
        let newMed: PIXI.Texture;
        let newSlow: PIXI.Texture;

        // Check if buffer size matches current dimensions
        if (historyRef.current.fast.length !== size) {
            // Resize needed. We lose history on resize (acceptable for window resize).
            historyRef.current.fast = new Uint8Array(size);
            historyRef.current.med = new Uint8Array(size);
            historyRef.current.slow = new Uint8Array(size);

            scanlineFastRef.current = 0;
            scanlineMedRef.current = 0;
            scanlineSlowRef.current = 0;
        }

        newFast = PIXI.Texture.fromBuffer(historyRef.current.fast, width, height);
        newMed = PIXI.Texture.fromBuffer(historyRef.current.med, width, height);
        newSlow = PIXI.Texture.fromBuffer(historyRef.current.slow, width, height);

        const newTextures = {
            fast: newFast,
            med: newMed,
            slow: newSlow
        };

        // Update Ref for cleanup
        texturesRef.current = newTextures;

        setTextures(prev => {
            // Destroy old textures to avoid leaks
            if (prev.fast) prev.fast.destroy(true);
            if (prev.med) prev.med.destroy(true);
            if (prev.slow) prev.slow.destroy(true);
            return newTextures;
        });

    }, [width, height]);

    // Cleanup textures on unmount
    useEffect(() => {
        return () => {
             // Use ref for cleanup to ensure it runs even if state updates are pending or ignored
             if (texturesRef.current) {
                 if (texturesRef.current.fast) texturesRef.current.fast.destroy(true);
                 if (texturesRef.current.med) texturesRef.current.med.destroy(true);
                 if (texturesRef.current.slow) texturesRef.current.slow.destroy(true);
                 texturesRef.current = null;
             }
        };
    }, []);

    useImperativeHandle(ref, () => ({
        processTick: (state: SubmarineState, updateMed: boolean, updateSlow: boolean) => {
            const updateFast = true; // Always update FAST
            if (!updateFast && !updateMed && !updateSlow) return;
            if (!historyRef.current) return;
            if (width === 0 || height === 0) return;

            // Generate Pixel Buffer for ONE line
            const pixelBuffer = new Uint8Array(width * 4);
            const { sensorReadings, contacts, torpedoes, x: ownX, y: ownY, heading: ownHeading, ownshipNoiseLevel } = state;

            const noiseFloor = Math.min(255, 30 + (ownshipNoiseLevel * 100));
            const selfNoisePenalty = ownshipNoiseLevel * 0.5;
            const signalBuffer = new Float32Array(width).fill(0);

            // 1. Calculate Signal from Contacts
            sensorReadings.forEach((reading) => {
                const contact = contacts.find(c => c.id === reading.contactId);
                if (!contact) return;

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

                let signedBearing = reading.bearing;
                if (signedBearing > 180) signedBearing -= 360;

                if (signedBearing >= -150 && signedBearing <= 150) {
                     const cx = Math.floor(((signedBearing + 150) / 300) * width);
                     for (let off = -1; off <= 2; off++) {
                         const x = cx + off;
                         if (x >= 0 && x < width) {
                             signalBuffer[x] = Math.max(signalBuffer[x], signal);
                         }
                     }
                }
            });

            // 2. Calculate Signal from Torpedoes
            torpedoes.forEach((torp) => {
                if (torp.status !== 'RUNNING') return;
                const dx = torp.position.x - ownX;
                const dy = torp.position.y - ownY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const distYards = distance / 3;
                const sourceLevel = 1.2;
                const scaleFactor = 0.0002;
                const signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));

                const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                const trueBearing = normalizeAngle(90 - mathAngleDeg);
                const relBearing = getShortestAngle(trueBearing, ownHeading);

                if (relBearing >= -150 && relBearing <= 150) {
                     const cx = Math.floor(((relBearing + 150) / 300) * width);
                     for (let off = -1; off <= 1; off++) {
                         const x = cx + off;
                         if (x >= 0 && x < width) {
                             signalBuffer[x] = Math.max(signalBuffer[x], signal);
                         }
                     }
                }
            });

            // 3. BQQ Processing
            const processedBuffer = new Float32Array(signalBuffer);
            for (let i = 1; i < width - 1; i++) {
                if (signalBuffer[i] > 0.8) {
                    if (signalBuffer[i-1] < 0.8) processedBuffer[i-1] *= 0.1;
                    if (signalBuffer[i+1] < 0.8) processedBuffer[i+1] *= 0.1;
                }
            }

            // 4. Render to Pixel Buffer
            for (let i = 0; i < width; i++) {
                const noise = Math.random() * noiseFloor;
                const signalVal = processedBuffer[i];
                const intensity = Math.min(255, noise + signalVal * 255);
                let r = 0;
                let b = 0;
                if (signalVal > 0.9) {
                    const clip = (signalVal - 0.9) * 10 * 150;
                    r = Math.min(255, clip);
                    b = Math.min(255, clip);
                }
                pixelBuffer[i * 4 + 0] = r;
                pixelBuffer[i * 4 + 1] = intensity;
                pixelBuffer[i * 4 + 2] = b;
                pixelBuffer[i * 4 + 3] = 255;
            }

            // Write to history buffers and update textures
            // Use local state 'textures' which is updated on resize
            const updateTexture = (
                buffer: Uint8Array,
                tex: PIXI.Texture | null,
                scanlineRef: React.MutableRefObject<number>
            ) => {
                // Fix: Check if texture is valid and not destroyed to prevent "reading 'width' of null" errors during resize
                if (!tex || !tex.baseTexture || tex.baseTexture.destroyed || !tex.valid) return;

                const offset = scanlineRef.current * width * 4;
                if (offset + pixelBuffer.length <= buffer.length) {
                    buffer.set(pixelBuffer, offset);
                    tex.update(); // Mark texture as dirty for GPU upload
                }
                scanlineRef.current = (scanlineRef.current + 1) % height;
            };

            if (updateFast) updateTexture(historyRef.current.fast, textures.fast, scanlineFastRef);
            if (updateMed) updateTexture(historyRef.current.med, textures.med, scanlineMedRef);
            if (updateSlow) updateTexture(historyRef.current.slow, textures.slow, scanlineSlowRef);
        },
        getCurrentScanline: () => {
            if (viewScale === 'FAST') return scanlineFastRef.current;
            if (viewScale === 'MED') return scanlineMedRef.current;
            return scanlineSlowRef.current;
        }
    }), [width, height, viewScale, textures]); // Re-create handle when textures change

    let activeTexture = textures.fast;
    if (viewScale === 'MED') activeTexture = textures.med;
    if (viewScale === 'SLOW') activeTexture = textures.slow;

    return (
        <Sprite
            texture={activeTexture || PIXI.Texture.EMPTY}
            eventMode="static"
            pointerdown={(e) => {
                 if (!e.currentTarget) return;
                 const localPoint = e.currentTarget.toLocal(e.global);
                 const x = localPoint.x;
                 const signedBearing = (x / width) * 300 - 150;
                 let bearing = signedBearing;
                 if (bearing < 0) bearing += 360;
                 useSubmarineStore.getState().designateTracker(bearing);
            }}
        />
    );
});

interface OverlayRef {
    scrollAndAddRow: (state: SubmarineState, updateMed: boolean, updateSlow: boolean) => void;
}

interface SolutionOverlayProps extends DimensionProps {
    visible: boolean;
    viewScale: ViewScale;
}

const SolutionOverlay = forwardRef<OverlayRef, SolutionOverlayProps>(({ width, height, visible, viewScale }, ref) => {
    // Separate containers for each speed
    const containerFastRef = useRef<PIXI.Container>(null);
    const containerMedRef = useRef<PIXI.Container>(null);
    const containerSlowRef = useRef<PIXI.Container>(null);

    // Track chunking for each speed
    const contextFast = useRef({ currentChunk: null as PIXI.Graphics | null, pixelCount: 0, lastPoints: new Map<string, number>() });
    const contextMed = useRef({ currentChunk: null as PIXI.Graphics | null, pixelCount: 0, lastPoints: new Map<string, number>() });
    const contextSlow = useRef({ currentChunk: null as PIXI.Graphics | null, pixelCount: 0, lastPoints: new Map<string, number>() });

    const CHUNK_SIZE = 100;

    useEffect(() => {
        if (containerFastRef.current) containerFastRef.current.visible = visible && viewScale === 'FAST';
        if (containerMedRef.current) containerMedRef.current.visible = visible && viewScale === 'MED';
        if (containerSlowRef.current) containerSlowRef.current.visible = visible && viewScale === 'SLOW';
    }, [visible, viewScale]);

    const processContainer = (container: PIXI.Container, context: any, state: SubmarineState) => {
        // 1. Scroll Container Down
        container.y += 1;
        const localY = -container.y;

        // 2. Manage Chunks
        if (!context.currentChunk || context.pixelCount >= CHUNK_SIZE) {
            const g = new PIXI.Graphics();
            (g as any).maxLocalY = localY;
            container.addChild(g);
            context.currentChunk = g;
            context.pixelCount = 0;
        }

        // Pruning
        const oldest = container.children[0] as any;
        if (oldest && oldest.maxLocalY !== undefined) {
             const screenBottomLocal = -container.y + height;
             if ((oldest.maxLocalY - CHUNK_SIZE) > screenBottomLocal + 100) {
                 oldest.destroy();
             }
         }

        context.pixelCount++;
        const g = context.currentChunk!;

        // 3. Draw Solutions
        const { trackers, gameTime, x: currX, y: currY, heading: currHeading } = state;
        const ownShip = { x: currX, y: currY, heading: currHeading };

        g.lineStyle(2, 0xffffff, 0.5);

        trackers.forEach((tracker) => {
            if (!tracker.solution) return;
            const targetPos = calculateTargetPosition(tracker.solution, gameTime);
            const dx = targetPos.x - ownShip.x;
            const dy = targetPos.y - ownShip.y;
            let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
            trueBearing = normalizeAngle(trueBearing);
            const relBearing = getShortestAngle(trueBearing, ownShip.heading);

            if (relBearing >= -150 && relBearing <= 150) {
                const x = ((relBearing + 150) / 300) * width;
                const lastX = context.lastPoints.get(tracker.id);
                const isNewChunk = context.pixelCount === 1;

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
                context.lastPoints.set(tracker.id, x);
            } else {
                context.lastPoints.delete(tracker.id);
            }
        });
    };

    useImperativeHandle(ref, () => ({
        scrollAndAddRow: (state: SubmarineState, updateMed: boolean, updateSlow: boolean) => {
            const updateFast = true;
            if (updateFast && containerFastRef.current) processContainer(containerFastRef.current, contextFast.current, state);
            if (updateMed && containerMedRef.current) processContainer(containerMedRef.current, contextMed.current, state);
            if (updateSlow && containerSlowRef.current) processContainer(containerSlowRef.current, contextSlow.current, state);
        }
    }));

    return (
        <>
            <Container ref={containerFastRef} visible={visible && viewScale === 'FAST'} />
            <Container ref={containerMedRef} visible={visible && viewScale === 'MED'} />
            <Container ref={containerSlowRef} visible={visible && viewScale === 'SLOW'} />
        </>
    );
});

const SonarBezel = ({ width }: { width: number }) => {
    // Throttled visual state (1Hz)
    const [visibleTrackers, setVisibleTrackers] = useState(() => useSubmarineStore.getState().trackers);

    useInterval(() => {
        setVisibleTrackers(useSubmarineStore.getState().trackers);
    }, 1000);

    return (
        <div className="absolute top-[-20px] left-0 pointer-events-none z-10" style={{ width: width, height: '100%' }}>
            {visibleTrackers.map((tracker) => {
                 let signedBearing = tracker.currentBearing;
                 if (signedBearing > 180) signedBearing -= 360;

                 // Check visibility within the +/- 150 degree window
                 if (signedBearing < -150 || signedBearing > 150) return null;

                 const x = ((signedBearing + 150) / 300) * width;

                 return (
                     <div
                        key={tracker.id}
                        className="absolute top-0 flex flex-col items-center"
                        style={{ left: x, transform: 'translateX(-50%)' }}
                     >
                        {/* Triangle pointing DOWN */}
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-[#33ff33]" />

                        {/* Tracker ID */}
                        <div className="text-[#33ff33] font-mono font-bold text-sm mt-0 shadow-black drop-shadow-md">
                            {tracker.id}
                        </div>
                     </div>
                 );
            })}
        </div>
    );
};

// Internal controller to handle the loop inside Stage context
const SonarInternals = ({ width, height, showSolution }: { width: number, height: number, showSolution: boolean }) => {
    const app = useApp();
    const waterfallRef = useRef<WaterfallRef>(null);
    const overlayRef = useRef<OverlayRef>(null);

    // State for shader
    const filterRef = useRef<SonarSweepFilter | null>(null);

    // Independent accumulators
    const accMed = useRef(0);
    const accSlow = useRef(0);

    const latestStateRef = useRef<SubmarineState>(useSubmarineStore.getState());

    useEffect(() => {
        const unsub = useSubmarineStore.subscribe((state) => {
            latestStateRef.current = state;
        });
        return unsub;
    }, []);

    const filter = useMemo(() => {
        const f = new SonarSweepFilter();
        filterRef.current = f;
        return f;
    }, []);

    useEffect(() => {
        if (filter) filter.uniforms.uResolution = [width, height];
    }, [width, height, filter]);

    useTick((delta) => {
        if (!filterRef.current) return;

        filterRef.current.uniforms.uTime += delta * 0.01;

        const deltaMS = app.ticker.deltaMS;

        // Accumulate time
        accMed.current += deltaMS;
        accSlow.current += deltaMS;

        const updateMed = accMed.current >= RATE_MED;
        const updateSlow = accSlow.current >= RATE_SLOW;

        if (updateMed) accMed.current -= RATE_MED;
        if (updateSlow) accSlow.current -= RATE_SLOW;

        // Always update FAST, conditionally update MED/SLOW
        waterfallRef.current?.processTick(latestStateRef.current, updateMed, updateSlow);
        overlayRef.current?.scrollAndAddRow(latestStateRef.current, updateMed, updateSlow);

        // Update Shader Scanline based on current VIEW
        if (waterfallRef.current && waterfallRef.current.getCurrentScanline) {
             filterRef.current.uniforms.uScanline = waterfallRef.current.getCurrentScanline();
        }
    });

    const viewScale = useSubmarineStore(state => state.viewScale);

    return (
        <>
            <Container filters={[filter]}>
                <Waterfall ref={waterfallRef} width={width} height={height} viewScale={viewScale} />
            </Container>
            <SolutionOverlay ref={overlayRef} width={width} height={height} visible={showSolution} viewScale={viewScale} />
        </>
    );
};

const SonarDisplay = () => {
    const { ref, width, height } = useResize();
    const [showSolution, setShowSolution] = useState(true);

    return (
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black">
            {width > 0 && height > 0 && (
                <div className="relative w-full h-full">
                    <div className="relative w-full h-full overflow-hidden">
                        <Stage width={width} height={height} options={{ background: 0x001100 }}>
                            <SonarInternals width={width} height={height} showSolution={showSolution} />
                        </Stage>
                    </div>
                    <SonarBezel width={width} />
                </div>
            )}

            {/* UI Overlay */}
            <div className="absolute top-2 right-2 flex gap-2">
                <button
                    className={`px-2 py-1 text-xs font-mono border rounded ${showSolution ? 'bg-green-900/50 text-green-400 border-green-600' : 'bg-gray-900/50 text-gray-500 border-gray-700'}`}
                    onClick={() => setShowSolution(!showSolution)}
                >
                    SOL
                </button>
            </div>
        </div>
    );
};

export default SonarDisplay;
