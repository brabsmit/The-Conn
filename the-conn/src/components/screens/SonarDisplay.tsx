import { useRef, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Container, Sprite, Graphics, Text, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { SonarSweepFilter } from './SonarShader';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
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

    const lineGraphics = useMemo(() => new PIXI.Graphics(), []);

    useImperativeHandle(ref, () => ({
        drawRow: (scanlineIndex: number) => {
            if (!app || !renderTexture.valid) return;

            lineGraphics.clear();

            // 1. Clear the line (draw black rect)
            lineGraphics.beginFill(0x000000, 1.0);
            lineGraphics.drawRect(0, scanlineIndex, width, 1);
            lineGraphics.endFill();

            const { sensorReadings, torpedoes, x: ownX, y: ownY, heading: ownHeading } = useSubmarineStore.getState();

            // 2. Draw Sensor Contacts
            sensorReadings.forEach((reading) => {
                let signedBearing = reading.bearing;
                if (signedBearing > 180) signedBearing -= 360;

                if (signedBearing >= -150 && signedBearing <= 150) {
                     const x = ((signedBearing + 150) / 300) * width;
                     lineGraphics.beginFill(0xccffcc, 1.0);
                     lineGraphics.drawRect(x, scanlineIndex, 4, 1);
                     lineGraphics.endFill();
                }
            });

            // 3. Draw Torpedoes
            torpedoes.forEach((torp) => {
                if (torp.status !== 'RUNNING') return;

                const dx = torp.position.x - ownX;
                const dy = torp.position.y - ownY;
                const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                const trueBearing = normalizeAngle(90 - mathAngleDeg);
                const relBearing = getShortestAngle(trueBearing, ownHeading);

                if (relBearing >= -150 && relBearing <= 150) {
                     const x = ((relBearing + 150) / 300) * width;
                     lineGraphics.beginFill(0xFFFFFF, 1.0);
                     lineGraphics.drawRect(x, scanlineIndex, 3, 1);
                     lineGraphics.endFill();
                }
            });

            // Render to texture
            app.renderer.render(lineGraphics, {
                renderTexture: renderTexture,
                clear: false
            });
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

const TrackerOverlay = ({ width }: { width: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;
        graphics.clear();
        const { trackers } = useSubmarineStore.getState();
        trackers.forEach((tracker) => {
             let signedBearing = tracker.currentBearing;
             if (signedBearing > 180) signedBearing -= 360;
             if (signedBearing >= -150 && signedBearing <= 150) {
                 const x = ((signedBearing + 150) / 300) * width;
                 graphics.beginFill(0x33ff33);
                 graphics.moveTo(x, 0);
                 graphics.lineTo(x - 5, 10);
                 graphics.lineTo(x + 5, 10);
                 graphics.closePath();
                 graphics.endFill();
             }
        });
    });

    const trackers = useSubmarineStore((state) => state.trackers);
    return (
        <Container>
            <Graphics ref={graphicsRef} />
            {trackers.map((tracker) => {
                 let signedBearing = tracker.currentBearing;
                 if (signedBearing > 180) signedBearing -= 360;
                 if (signedBearing < -150 || signedBearing > 150) return null;
                 const x = ((signedBearing + 150) / 300) * width;
                 return (
                     <Text
                        key={tracker.id}
                        text={tracker.id}
                        x={x}
                        y={12}
                        anchor={0.5}
                        style={new PIXI.TextStyle({ fill: '#33ff33', fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' })}
                     />
                 );
            })}
        </Container>
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
            <TrackerOverlay width={width} />
        </>
    );
};

const SonarDisplay = () => {
    const { ref, width, height } = useResize();
    const [showSolution, setShowSolution] = useState(true);

    return (
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black overflow-hidden">
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: 0x001100 }}>
                    <SonarInternals width={width} height={height} showSolution={showSolution} />
                </Stage>
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
