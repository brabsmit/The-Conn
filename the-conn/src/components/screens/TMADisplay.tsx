import { useMemo, useRef } from 'react';
import { Stage, Container, Graphics, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';

const DotStack = ({ width, height }: { width: number, height: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const PIXELS_PER_SECOND = 10; // Speed of fall

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        const { trackers, gameTime, ownShipHistory, heading: currentHeading } = useSubmarineStore.getState();

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
        trackers.forEach(tracker => {
            graphics.beginFill(0x33ff33, 0.8);
            tracker.bearingHistory.forEach(history => {
                // Find OwnShip state at that history time to reconstruct True Bearing
                // Optimization: Iterate backwards or assume sync?
                // The arrays are synced every 60 ticks.
                const ownShipState = ownShipHistory.find(os => Math.abs(os.time - history.time) < 0.1);

                if (ownShipState) {
                    // Reconstruct True Bearing at that time
                    const trueBearingAtTime = normalizeAngle(history.bearing + ownShipState.heading);

                    // Calculate relative bearing to Current Heading
                    const angleDiff = getShortestAngle(trueBearingAtTime, currentHeading);

                    // Draw if within visible range (-180 to +180)
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
            graphics.endFill();
        });

        // Draw Solution Line
        // Color: White (0xffffff)
        const { selectedTrackerId } = useSubmarineStore.getState();
        const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

        if (selectedTracker && selectedTracker.solution && selectedTracker.solution.anchorTime !== undefined) {
             const solution = selectedTracker.solution;

             graphics.lineStyle(2, 0xffffff, 0.8);

             // 1. Current Point
             const currentOwnShip = {
                 x: useSubmarineStore.getState().x,
                 y: useSubmarineStore.getState().y,
                 heading: currentHeading
             };

             const targetPosNow = calculateTargetPosition(solution as any, gameTime);
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
                    const targetPos = calculateTargetPosition(solution as any, h.time);
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
    });

    return <Graphics ref={graphicsRef} />;
};

const Grid = ({ width, height }: { width: number, height: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const heading = useSubmarineStore(state => state.heading);

    useTick(() => {
        const g = graphicsRef.current;
        if (!g) return;

        g.clear();
        // Grid Lines: Very dim green (alpha: 0.1)
        g.lineStyle(1, 0x33FF33, 0.1);

        const PIXELS_PER_DEGREE = width / 360;
        const SCREEN_CENTER = width / 2;

        // Current Heading allows us to shift the grid
        const currentHeading = useSubmarineStore.getState().heading;

        // Draw Vertical Lines every 30 degrees (World Bearing)
        for (let b = 0; b < 360; b += 30) {
             const diff = getShortestAngle(b, currentHeading);
             // Full 360 view: range -180 to 180
             if (diff >= -180 && diff <= 180) {
                 const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);
                 g.moveTo(x, 0);
                 g.lineTo(x, height);

                 // Edge Case: If diff is -180, it draws at x=0.
                 // We should also draw at x=width (which is +180) to complete the wrap visually.
                 if (diff === -180) {
                     const xRight = width; // SCREEN_CENTER + (180 * PIXELS_PER_DEGREE)
                     g.moveTo(xRight, 0);
                     g.lineTo(xRight, height);
                 }
             }
        }

        // Horizontal lines (Time)
        for (let y = 0; y <= height; y += 50) {
            g.moveTo(0, y);
            g.lineTo(width, y);
        }
    });

    // Generate Labels
    const labels = useMemo(() => {
        const result = [];
        for (let b = 0; b < 360; b += 30) {
             result.push(b);
        }
        return result;
    }, []);

    const PIXELS_PER_DEGREE = width / 360;
    const SCREEN_CENTER = width / 2;

    return (
        <Container>
            <Graphics ref={graphicsRef} />
            {labels.map(angle => {
                 const diff = getShortestAngle(angle, heading);
                 if (diff < -180 || diff > 180) return null;
                 const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);

                 // If diff is -180, it's at x=0. We might also want to render it at x=width?
                 // But for text, maybe just left edge is fine.
                 // Actually, if we want to mimic the grid lines, we should render it at right too?
                 // But React keys must be unique. Rendering twice is tricky in this map.
                 // Let's stick to rendering once. If it's at -180 (x=0), it's visible on left.

                 return (
                     <Text
                        key={angle}
                        text={angle.toString().padStart(3, '0')}
                        x={x}
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
                 );
            })}
             {/* Special case for right-edge label if needed?
                 If there's an angle with diff -180, we could render a +180 label at x=width.
                 The angle is the same (e.g. 180 deg).
              */}
              {labels.map(angle => {
                 const diff = getShortestAngle(angle, heading);
                 if (diff === -180) {
                      return (
                         <Text
                            key={`${angle}-right`}
                            text={angle.toString().padStart(3, '0')}
                            x={width}
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
                     );
                 }
                 return null;
              })}
        </Container>
    );
};

const TMADisplay = () => {
    const width = 700;
    const height = 500;

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
        <div className="flex justify-center items-center w-full h-full bg-black">
            <Stage width={width} height={height} options={{ background: 0x001100 }}>
                <Container filters={crtFilter ? [crtFilter] : []}>
                     <Grid width={width} height={height} />
                     <DotStack width={width} height={height} />
                </Container>
            </Stage>
        </div>
    );
};

export default TMADisplay;
