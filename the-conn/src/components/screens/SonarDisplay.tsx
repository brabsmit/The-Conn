import { useRef, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Container, Sprite, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { SonarSweepFilter } from './SonarShader';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { useInterval } from '../../hooks/useInterval';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';

// Types for data passing (Decoupled from store implementation)
type SubmarineState = ReturnType<typeof useSubmarineStore.getState>;

interface DimensionProps {
    width: number;
    height: number;
}

interface WaterfallRef {
    drawRow: (scanlineIndex: number, state: SubmarineState) => void;
}

const Waterfall = forwardRef<WaterfallRef, DimensionProps>(({ width, height }, ref) => {
    const app = useApp();

    const renderTextureRef = useRef<PIXI.RenderTexture | null>(null);

    // Initialize once on mount
    if (!renderTextureRef.current) {
        renderTextureRef.current = PIXI.RenderTexture.create({ width, height });
    }
    const renderTexture = renderTextureRef.current;

    useEffect(() => {
        return () => {
             renderTexture.destroy(true);
        };
    }, []);

    // Handle resize without recreating texture (preserves history)
    useEffect(() => {
        if (renderTexture.width !== width || renderTexture.height !== height) {
             renderTexture.resize(width, height);
        }
    }, [width, height, renderTexture]);

    useImperativeHandle(ref, () => ({
        drawRow: (scanlineIndex: number, state: SubmarineState) => {
            if (!app || !renderTexture.valid) return;

            // Create Buffer (RGBA)
            const buffer = new Uint8Array(width * 4);
            const { sensorReadings, contacts, torpedoes, x: ownX, y: ownY, heading: ownHeading, ownshipNoiseLevel } = state;

            // Dynamic Noise Floor based on Ownship Noise
            // Base 30, add up to 200 based on noise level (0.1 to 1.5+)
            const noiseFloor = Math.min(255, 30 + (ownshipNoiseLevel * 100));

            // Self Noise Penalty (reduces effective signal)
            const selfNoisePenalty = ownshipNoiseLevel * 0.5;

            // 0. Prepare Signal Buffer (Float32) for accumulation
            const signalBuffer = new Float32Array(width).fill(0);

            // 1. Calculate Signal from Contacts
            sensorReadings.forEach((reading) => {
                const contact = contacts.find(c => c.id === reading.contactId);
                if (!contact) return;

                // Acoustic Profile
                let sourceLevel = contact.sourceLevel || 1.0;
                const cavitationSpeed = contact.cavitationSpeed || 100;

                // Dynamic Noise (Cavitation)
                if (contact.speed !== undefined && contact.speed > cavitationSpeed) {
                    sourceLevel += 0.5;
                }

                // Transmission Loss
                const dx = contact.x - ownX;
                const dy = contact.y - ownY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const distYards = distance / 3;

                // Received Level = Source / (Distance * Scale)
                const scaleFactor = 0.0002;
                let signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));

                // Apply Self Noise Penalty
                signal = Math.max(0, signal - selfNoisePenalty);

                // Map to Screen
                let signedBearing = reading.bearing;
                if (signedBearing > 180) signedBearing -= 360;

                if (signedBearing >= -150 && signedBearing <= 150) {
                     const cx = Math.floor(((signedBearing + 150) / 300) * width);
                     // Draw 4px wide
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

                const sourceLevel = 1.2; // Screaming Loud
                const scaleFactor = 0.0002;
                const signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));

                const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                const trueBearing = normalizeAngle(90 - mathAngleDeg);
                const relBearing = getShortestAngle(trueBearing, ownHeading);

                if (relBearing >= -150 && relBearing <= 150) {
                     const cx = Math.floor(((relBearing + 150) / 300) * width);
                     // Draw 3px wide
                     for (let off = -1; off <= 1; off++) {
                         const x = cx + off;
                         if (x >= 0 && x < width) {
                             signalBuffer[x] = Math.max(signalBuffer[x], signal);
                         }
                     }
                }
            });

            // 3. BQQ Processing (Shouldering / AGC)
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

                // Saturation Clipping
                if (signalVal > 0.9) {
                    const clip = (signalVal - 0.9) * 10 * 150;
                    r = Math.min(255, clip);
                    b = Math.min(255, clip);
                }

                buffer[i * 4 + 0] = r;
                buffer[i * 4 + 1] = intensity;
                buffer[i * 4 + 2] = b;
                buffer[i * 4 + 3] = 255;
            }

            // Render to texture
            const texture = PIXI.Texture.fromBuffer(buffer, width, 1);
            const sprite = new PIXI.Sprite(texture);
            sprite.y = scanlineIndex;

            app.renderer.render(sprite, {
                renderTexture: renderTexture,
                clear: false
            });

            sprite.destroy();
            texture.destroy(true);
        }
    }));

    return (
        <Sprite
            texture={renderTexture}
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
    scrollAndAddRow: (state: SubmarineState) => void;
}

interface SolutionOverlayProps extends DimensionProps {
    visible: boolean;
}

const SolutionOverlay = forwardRef<OverlayRef, SolutionOverlayProps>(({ width, height, visible }, ref) => {
    const containerRef = useRef<PIXI.Container>(null);
    const currentChunkRef = useRef<PIXI.Graphics | null>(null);
    const chunkPixelCount = useRef(0);
    const lastPointsRef = useRef<Map<string, number>>(new Map());

    const CHUNK_SIZE = 100;

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.visible = visible;
        }
    }, [visible]);

    useImperativeHandle(ref, () => {
        return {
            scrollAndAddRow: (state: SubmarineState) => {
                if (!containerRef.current) return;

                const container = containerRef.current;

                // 1. Scroll Container Down
                container.y += 1;
                const localY = -container.y;

                // 2. Manage Chunks
                if (!currentChunkRef.current || chunkPixelCount.current >= CHUNK_SIZE) {
                    const g = new PIXI.Graphics();
                    (g as any).maxLocalY = localY;
                    container.addChild(g);
                    currentChunkRef.current = g;
                    chunkPixelCount.current = 0;
                }

                // Pruning
                const oldest = container.children[0] as any;
                if (oldest && oldest.maxLocalY !== undefined) {
                     const screenBottomLocal = -container.y + height;
                     if ((oldest.maxLocalY - CHUNK_SIZE) > screenBottomLocal + 100) {
                         oldest.destroy();
                     }
                 }

                chunkPixelCount.current++;
                const g = currentChunkRef.current!;

                // 3. Draw Solutions
                const { trackers, gameTime, x: currX, y: currY, heading: currHeading } = state;
                const ownShip = { x: currX, y: currY, heading: currHeading };

                g.lineStyle(2, 0xffffff, 0.5);

                trackers.forEach(tracker => {
                    if (!tracker.solution) return;
                    const targetPos = calculateTargetPosition(tracker.solution, gameTime);
                    const dx = targetPos.x - ownShip.x;
                    const dy = targetPos.y - ownShip.y;
                    let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                    trueBearing = normalizeAngle(trueBearing);
                    const relBearing = getShortestAngle(trueBearing, ownShip.heading);

                    if (relBearing >= -150 && relBearing <= 150) {
                        const x = ((relBearing + 150) / 300) * width;
                        const lastX = lastPointsRef.current.get(tracker.id);
                        const isNewChunk = chunkPixelCount.current === 1;

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
                        lastPointsRef.current.set(tracker.id, x);
                    } else {
                        lastPointsRef.current.delete(tracker.id);
                    }
                });
            }
        }
    });

    return <Container ref={containerRef} />;
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
    const waterfallRef = useRef<WaterfallRef>(null);
    const overlayRef = useRef<OverlayRef>(null);

    // State for shader
    const filterRef = useRef<SonarSweepFilter | null>(null);
    const scanlineIndex = useRef(0);
    const updateAccumulator = useRef(0);

    // [Ref Pattern] Hold latest state in a ref to avoid stale closures and re-renders
    // This decouples the initialization (component mount) from the tracker state updates.
    // We use subscribe() instead of useSelector to prevent re-renders of the SonarInternals component.
    const latestStateRef = useRef<SubmarineState>(useSubmarineStore.getState());

    useEffect(() => {
        const unsub = useSubmarineStore.subscribe((state) => {
            latestStateRef.current = state;
        });
        return unsub;
    }, []);

    // Create filter once
    const filter = useMemo(() => {
        const f = new SonarSweepFilter();
        filterRef.current = f;
        return f;
    }, []);

    // Update filter resolution on resize
    useEffect(() => {
        if (filter) filter.uniforms.uResolution = [width, height];
    }, [width, height, filter]);

    // Main Update Loop
    useTick((delta) => {
        if (!filterRef.current) return;

        // Update Time for noise
        filterRef.current.uniforms.uTime += delta * 0.01;

        const { timeScale } = latestStateRef.current;
        let threshold = 60; // Default MED (1 sec)
        if (timeScale === 'FAST') threshold = 6;
        if (timeScale === 'SLOW') threshold = 180;

        updateAccumulator.current += delta;

        if (updateAccumulator.current >= threshold) {
            let loops = 0;
            while (updateAccumulator.current >= threshold && loops < 5) {
                // Pass the latest state explicitly from the ref
                waterfallRef.current?.drawRow(scanlineIndex.current, latestStateRef.current);
                overlayRef.current?.scrollAndAddRow(latestStateRef.current);

                scanlineIndex.current += 1;
                if (scanlineIndex.current >= height) {
                    scanlineIndex.current = 0;
                }

                updateAccumulator.current -= threshold;
                loops++;
            }
            if (updateAccumulator.current >= threshold) updateAccumulator.current = 0;

            filterRef.current.uniforms.uScanline = scanlineIndex.current;
        }
    });

    return (
        <>
            <Container filters={[filter]}>
                <Waterfall ref={waterfallRef} width={width} height={height} />
            </Container>
            <SolutionOverlay ref={overlayRef} width={width} height={height} visible={showSolution} />
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
