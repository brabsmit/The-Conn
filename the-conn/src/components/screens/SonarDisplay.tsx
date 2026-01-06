import { useRef, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Container, Sprite, Graphics, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { SonarSweepFilter } from './SonarShader';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { useInterval } from '../../hooks/useInterval';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';

interface DimensionProps {
    width: number;
    height: number;
}

interface WaterfallRef {
    drawRow: (scanlineIndex: number) => void;
}

const Waterfall = forwardRef<WaterfallRef, DimensionProps>(({ width, height }, ref) => {
    const app = useApp();

    const renderTexture = useMemo(() => {
        return PIXI.RenderTexture.create({ width, height });
    }, [width, height]);

    useEffect(() => {
        return () => {
             renderTexture.destroy(true);
        };
    }, [renderTexture]);

    useImperativeHandle(ref, () => ({
        drawRow: (scanlineIndex: number) => {
            if (!app || !renderTexture.valid) return;

            // Create Buffer (RGBA)
            const buffer = new Uint8Array(width * 4);
            const noiseFloor = 30; // 0-255 range, approx 0.1-0.2 intensity

            // 0. Prepare Signal Buffer (Float32) for accumulation
            const signalBuffer = new Float32Array(width).fill(0);

            const { sensorReadings, contacts, torpedoes, x: ownX, y: ownY, heading: ownHeading } = useSubmarineStore.getState();

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
                const distance = Math.sqrt(dx * dx + dy * dy); // yards * 3? No wait, store positions are feet?
                // Looking at updatePosition: distance = newSpeed * FEET_PER_KNOT_PER_TICK
                // So x, y are in Feet.
                // Distance in yards = distance / 3.
                const distYards = distance / 3;

                // Received Level = Source / (Distance * Scale)
                // Tuning:
                // 5k yards -> Bright (1.0). 1.0 / (5000 * S) = 1.0 => S = 1/5000 = 0.0002.
                // 20k yards -> Faint. 1.0 / (20000 * 0.0002) = 1.0 / 4 = 0.25 (Visible but faint).
                const scaleFactor = 0.0002;
                const signal = Math.min(1.0, sourceLevel / (Math.max(1, distYards) * scaleFactor));

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
            // Contrast Pass: Suppress neighbors of strong signals
            // Guard against self-suppression in wide signals by only suppressing weaker neighbors.
            const processedBuffer = new Float32Array(signalBuffer);
            for (let i = 1; i < width - 1; i++) {
                if (signalBuffer[i] > 0.8) {
                    // Only suppress if the neighbor is significantly weaker (not part of the peak)
                    if (signalBuffer[i-1] < 0.8) processedBuffer[i-1] *= 0.1; // Darken left hard
                    if (signalBuffer[i+1] < 0.8) processedBuffer[i+1] *= 0.1; // Darken right hard
                }
            }

            // 4. Render to Pixel Buffer
            for (let i = 0; i < width; i++) {
                const noise = Math.random() * noiseFloor;
                const signalVal = processedBuffer[i];

                // Color Mapping:
                // Low signal: Green
                // High signal (>0.5): Desaturate towards White

                const intensity = Math.min(255, noise + signalVal * 255);

                let r = 0;
                let b = 0;

                if (signalVal > 0.5) {
                    // Add R/B components as signal approaches 1.0 to create white
                    const whiteness = (signalVal - 0.5) * 2 * 255;
                    r = Math.min(255, whiteness);
                    b = Math.min(255, whiteness);
                }

                buffer[i * 4 + 0] = r;              // R
                buffer[i * 4 + 1] = intensity;      // G
                buffer[i * 4 + 2] = b;              // B
                buffer[i * 4 + 3] = 255;            // A
            }

            // Render to texture
            // PIXI.Texture.fromBuffer creates a new BaseTexture by default.
            // We must destroy it after use to prevent memory leaks.
            const texture = PIXI.Texture.fromBuffer(buffer, width, 1);
            const sprite = new PIXI.Sprite(texture);
            sprite.y = scanlineIndex;

            app.renderer.render(sprite, {
                renderTexture: renderTexture,
                clear: false
            });

            sprite.destroy();
            texture.destroy(true); // true = destroy base texture
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
    scrollAndAddRow: () => void;
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
            scrollAndAddRow: () => {
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
                const { trackers, gameTime, x: currX, y: currY, heading: currHeading } = useSubmarineStore.getState();
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
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-hidden">
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

        const { timeScale } = useSubmarineStore.getState();
        let threshold = 60; // Default MED (1 sec)
        if (timeScale === 'FAST') threshold = 6;
        if (timeScale === 'SLOW') threshold = 180;

        updateAccumulator.current += delta;

        if (updateAccumulator.current >= threshold) {
            let loops = 0;
            while (updateAccumulator.current >= threshold && loops < 5) {
                waterfallRef.current?.drawRow(scanlineIndex.current);
                overlayRef.current?.scrollAndAddRow();

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
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black overflow-hidden">
            {width > 0 && height > 0 && (
                <>
                    <Stage width={width} height={height} options={{ background: 0x001100 }}>
                        <SonarInternals width={width} height={height} showSolution={showSolution} />
                    </Stage>
                    <SonarBezel width={width} />
                </>
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
