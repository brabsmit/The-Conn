import { useMemo, useRef, useState } from 'react';
import { Stage, Container, Graphics, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';
import { useResize } from '../../hooks/useResize';

type ViewMode = 'GEO' | 'DOTS';

interface DisplayProps {
    width: number;
    height: number;
    viewMode: ViewMode;
}

const DotStack = ({ width, height, viewMode }: DisplayProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        const { trackers, gameTime, ownShipHistory, heading: currentHeading, selectedTrackerId, timeScale } = useSubmarineStore.getState();

        // Calculate Pixels Per Second based on timeScale
        let PIXELS_PER_SECOND = 10; // FAST: 100ms/pixel -> 10px/s
        if (timeScale === 'MED') PIXELS_PER_SECOND = 1; // MED: 1000ms/pixel -> 1px/s
        if (timeScale === 'SLOW') PIXELS_PER_SECOND = 1.0 / 3.0; // SLOW: 3000ms/pixel -> 0.33px/s

        const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

        if (viewMode === 'GEO') {
            const PIXELS_PER_DEGREE = width / 360;
            const SCREEN_CENTER = width / 2;

            // Draw Ownship Heading Trace
            // Color: Blue (0x3333ff)
            graphics.lineStyle(2, 0x3333ff, 0.6);
            let firstTracePoint = true;
            let lastX = 0;

            ownShipHistory.forEach((history) => {
                const age = gameTime - history.time;
                const y = age * PIXELS_PER_SECOND;

                if (y >= -50 && y <= height + 50) {
                    // Course-Up Logic:
                    // Plot the relative angle of the history heading vs current heading
                    const angleDiff = getShortestAngle(history.heading, currentHeading);
                    const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);

                    if (firstTracePoint) {
                        graphics.moveTo(x, y);
                        firstTracePoint = false;
                    } else {
                        if (Math.abs(x - lastX) > width / 3) {
                             graphics.moveTo(x, y);
                        } else {
                             graphics.lineTo(x, y);
                        }
                    }
                    lastX = x;
                } else {
                    firstTracePoint = true;
                }
            });

            // Reset line style for dots
            graphics.lineStyle(0);

            // Draw Tracker History
            // Color: Green (0x33ff33)
            graphics.beginFill(0x33ff33, 0.8);
            trackers.forEach(tracker => {
                let osIndex = 0;
                tracker.bearingHistory.forEach(history => {
                    // Optimized lookup: fast forward osIndex
                    while (osIndex < ownShipHistory.length && ownShipHistory[osIndex].time < history.time - 0.1) {
                        osIndex++;
                    }

                    if (osIndex < ownShipHistory.length && Math.abs(ownShipHistory[osIndex].time - history.time) < 0.1) {
                        const ownShipState = ownShipHistory[osIndex];
                        const trueBearingAtTime = normalizeAngle(history.bearing + ownShipState.heading);
                        const angleDiff = getShortestAngle(trueBearingAtTime, currentHeading);

                        if (angleDiff >= -180 && angleDiff <= 180) {
                             const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);
                             const age = gameTime - history.time;
                             const y = age * PIXELS_PER_SECOND;

                             if (y >= -5 && y <= height + 5) {
                                 graphics.drawCircle(x, y, 2.5);
                             }
                        }
                    }
                });
            });
            graphics.endFill();

            // Draw Solution Line
            if (selectedTracker && selectedTracker.solution) {
                 const solution = selectedTracker.solution;
                 graphics.lineStyle(2, 0xffffff, 0.8);

                 // 1. Current Point
                 const currentOwnShip = {
                     x: useSubmarineStore.getState().x,
                     y: useSubmarineStore.getState().y,
                     heading: currentHeading
                 };

                 const targetPosNow = calculateTargetPosition(solution, gameTime);
                 const dxNow = targetPosNow.x - currentOwnShip.x;
                 const dyNow = targetPosNow.y - currentOwnShip.y;
                 let trueBearingNow = Math.atan2(dxNow, dyNow) * (180 / Math.PI);
                 trueBearingNow = normalizeAngle(trueBearingNow);

                 const angleDiffNow = getShortestAngle(trueBearingNow, currentHeading);
                 const xNow = SCREEN_CENTER + (angleDiffNow * PIXELS_PER_DEGREE);

                 graphics.moveTo(xNow, 0);
                 let lastX = xNow;

                 // 2. History Points
                 for (let i = selectedTracker.bearingHistory.length - 1; i >= 0; i--) {
                    const h = selectedTracker.bearingHistory[i];
                    const age = gameTime - h.time;
                    const y = age * PIXELS_PER_SECOND;

                    if (y > height + 5) continue;

                    const ownShipState = ownShipHistory.find(os => Math.abs(os.time - h.time) < 0.1);

                    if (ownShipState) {
                        const targetPos = calculateTargetPosition(solution, h.time);
                        const dx = targetPos.x - ownShipState.x;
                        const dy = targetPos.y - ownShipState.y;

                        let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                        trueBearing = normalizeAngle(trueBearing);

                        const angleDiff = getShortestAngle(trueBearing, currentHeading);
                        const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);

                         if (Math.abs(x - lastX) > width / 3) {
                             graphics.moveTo(x, y);
                         } else {
                             graphics.lineTo(x, y);
                         }
                         lastX = x;
                    }
                 }
            }
        } else {
            // DOTS Mode (Residuals)
            const RANGE_DEGREES = 20; // +/- 10
            const PIXELS_PER_DEGREE = width / RANGE_DEGREES;
            const SCREEN_CENTER = width / 2;

            // Draw Center Line (Solution)
            graphics.lineStyle(2, 0xffffff, 0.5);
            graphics.moveTo(SCREEN_CENTER, 0);
            graphics.lineTo(SCREEN_CENTER, height);

            // Draw Residuals
            if (selectedTracker) {
                graphics.lineStyle(0);
                graphics.beginFill(0x33ff33, 0.8);

                selectedTracker.bearingHistory.forEach(history => {
                    const ownShipState = ownShipHistory.find(os => Math.abs(os.time - history.time) < 0.1);

                    if (ownShipState && selectedTracker.solution) {
                        // Sensor True Bearing
                        const sensorTrueBearing = normalizeAngle(history.bearing + ownShipState.heading);

                        // Solution True Bearing
                        const targetPos = calculateTargetPosition(selectedTracker.solution, history.time);
                        const dx = targetPos.x - ownShipState.x;
                        const dy = targetPos.y - ownShipState.y;
                        let solutionTrueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                        solutionTrueBearing = normalizeAngle(solutionTrueBearing);

                        // Residual
                        const residual = getShortestAngle(sensorTrueBearing, solutionTrueBearing);

                        // Plot
                        // x corresponds to residual. Center is 0.
                        const x = SCREEN_CENTER + (residual * PIXELS_PER_DEGREE);
                        const age = gameTime - history.time;
                        const y = age * PIXELS_PER_SECOND;

                        if (y >= -5 && y <= height + 5) {
                            // Clip to screen width to avoid drawing outside if error is huge
                            if (x >= 0 && x <= width) {
                                graphics.drawCircle(x, y, 2.5);
                            }
                        }
                    }
                });
                graphics.endFill();
            }
        }
    });

    return <Graphics ref={graphicsRef} />;
};

const Grid = ({ width, height, viewMode }: DisplayProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const labelsContainerRef = useRef<PIXI.Container | null>(null);

    // Static list of angles for labels
    const labels = useMemo(() => {
        const result = [];
        for (let b = 0; b < 360; b += 30) {
             result.push(b);
        }
        return result;
    }, []);

    useTick(() => {
        const g = graphicsRef.current;
        if (!g) return;

        g.clear();
        // Grid Lines: Very dim green (alpha: 0.1)
        g.lineStyle(1, 0x33FF33, 0.1);

        const { heading: currentHeading } = useSubmarineStore.getState();
        const PIXELS_PER_DEGREE = width / 360;
        const SCREEN_CENTER = width / 2;

        if (viewMode === 'GEO') {
            for (let b = 0; b < 360; b += 30) {
                 const diff = getShortestAngle(b, currentHeading);
                 if (diff >= -180 && diff <= 180) {
                     const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);
                     g.moveTo(x, 0);
                     g.lineTo(x, height);
                     if (diff === -180) {
                         const xRight = width;
                         g.moveTo(xRight, 0);
                         g.lineTo(xRight, height);
                     }
                 }
            }
        } else {
            // DOTS Mode Grid - Keeping it clean with just horizontal lines for now
        }

        // Horizontal lines (Time)
        // Adjust grid line spacing based on timeScale?
        // Or keep pixel spacing fixed and let time vary?
        // Let's keep pixel spacing fixed (e.g. 50px).
        for (let y = 0; y <= height; y += 50) {
            g.moveTo(0, y);
            g.lineTo(width, y);
        }

        // Update Labels Positions
        const container = labelsContainerRef.current;
        if (container && viewMode === 'GEO') {
            const children = container.children as PIXI.Text[];

            labels.forEach((angle, index) => {
                const textObj = children[index];
                if (!textObj) return;

                const diff = getShortestAngle(angle, currentHeading);
                const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);
                textObj.x = x;
                textObj.visible = true; // Always visible in GEO
            });

            // Handle wrap duplicates
            // We can use a dedicated pool of text objects for "right side" duplicates.
            // Let's say children[12+] are for duplicates.
            // Reset them to invisible first.
            for (let i = 12; i < children.length; i++) {
                children[i].visible = false;
            }

            let dupIndex = 12;
            labels.forEach((angle) => {
                const diff = getShortestAngle(angle, currentHeading);
                if (Math.abs(diff + 180) < 0.1) { // Close to -180
                     // This label is at x=0. We also want it at x=width.
                     if (dupIndex < children.length) {
                         const dup = children[dupIndex];
                         dup.text = angle.toString().padStart(3, '0');
                         dup.x = width;
                         dup.visible = true;
                         dupIndex++;
                     }
                }
            });
        } else if (container && viewMode === 'DOTS') {
             // Hide all labels in DOTS mode for now (or implement DOTS specific labels)
             container.visible = false;
        }

        if (container && viewMode === 'GEO') {
             container.visible = true;
        }
    });

    if (viewMode === 'DOTS') return <Container><Graphics ref={graphicsRef} /></Container>;

    return (
        <Container>
            <Graphics ref={graphicsRef} />
            <Container ref={labelsContainerRef}>
                {/* Primary Labels (0-11) */}
                {labels.map(angle => (
                     <Text
                        key={angle}
                        text={angle.toString().padStart(3, '0')}
                        x={0} // Updated in useTick
                        y={10}
                        anchor={0.5}
                        style={
                            new PIXI.TextStyle({
                                fill: '#33FF33',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                // @ts-ignore
                                alpha: 0.5
                            })
                        }
                     />
                ))}
                {/* Duplicate/Wrap Labels (Reserve a few, e.g. 2) */}
                {[0, 1].map(i => (
                     <Text
                        key={`dup-${i}`}
                        text=""
                        x={0}
                        y={10}
                        anchor={0.5}
                        visible={false}
                        style={
                            new PIXI.TextStyle({
                                fill: '#33FF33',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                // @ts-ignore
                                alpha: 0.5
                            })
                        }
                     />
                ))}
            </Container>
        </Container>
    );
};

const TMADisplay = () => {
    const { ref, width, height } = useResize();
    const [viewMode, setViewMode] = useState<ViewMode>('GEO');

    const crtFilter = useMemo(() => {
        try {
            return new CRTFilter({
                lineWidth: 1,
                lineContrast: 0.3,
                noise: 0.1,
                noiseSize: 1.0,
                vignetting: 0.3,
                vignettingAlpha: 1.0,
                vignettingBlur: 0.3,
            });
        } catch (e) {
            console.error("Failed to init CRTFilter", e);
            return null;
        }
    }, []);

    return (
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black overflow-hidden">
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: 0x001100 }}>
                    <Container filters={crtFilter ? [crtFilter] : []}>
                        <Grid width={width} height={height} viewMode={viewMode} />
                        <DotStack width={width} height={height} viewMode={viewMode} />
                    </Container>
                </Stage>
            )}

            {/* UI Overlay */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                <button
                    className="bg-gray-800 text-green-500 border border-green-700 px-3 py-1 rounded cursor-pointer hover:bg-gray-700 font-mono text-sm"
                    onClick={() => setViewMode(prev => prev === 'GEO' ? 'DOTS' : 'GEO')}
                >
                    [{viewMode}]
                </button>
                {viewMode === 'DOTS' && (
                    <div className="text-green-500 font-mono text-xs bg-black/50 p-1">
                        SCALE: +/- 10°
                    </div>
                )}
            </div>
        </div>
    );
};

export default TMADisplay;
