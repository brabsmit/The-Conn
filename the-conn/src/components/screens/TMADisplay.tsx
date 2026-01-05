import { useMemo, useRef } from 'react';
import { Stage, Container, Graphics, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle } from '../../lib/tma';

const DotStack = ({ width, height }: { width: number, height: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const PIXELS_PER_SECOND = 10; // Speed of fall

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        const { trackers, gameTime, ownShipHistory } = useSubmarineStore.getState();

        // Draw Ownship Heading Trace
        graphics.lineStyle(2, 0x4444FF, 0.6);
        let firstTracePoint = true;
        let lastX = 0;

        // Iterate through history to draw the line
        // ownShipHistory is ordered Oldest -> Newest
        // We want to draw typically from Newest (top) to Oldest (bottom) or vice versa.
        // If we just iterate array order (Old -> New), y decreases (as age decreases).
        // Let's iterate normally.
        ownShipHistory.forEach((history) => {
            const age = gameTime - history.time;
            const y = age * PIXELS_PER_SECOND;

            // Only draw if within reasonable bounds (allow some overflow for continuity)
            if (y >= -50 && y <= height + 50) {
                let signedHeading = history.heading;
                if (signedHeading > 180) signedHeading -= 360;

                const x = ((signedHeading + 150) / 300) * width;

                if (firstTracePoint) {
                    graphics.moveTo(x, y);
                    firstTracePoint = false;
                } else {
                    // Check for wrap-around (e.g. crossing 180/-180)
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

        trackers.forEach(tracker => {
            graphics.beginFill(0x33ff33, 0.8);
            tracker.bearingHistory.forEach(history => {
                // Map to -150 to +150 range centered on 0
                let signedBearing = history.bearing;
                if (signedBearing > 180) signedBearing -= 360;

                // Only draw if within visible range
                if (signedBearing >= -150 && signedBearing <= 150) {
                    const x = ((signedBearing + 150) / 300) * width;
                    const age = gameTime - history.time;
                    const y = age * PIXELS_PER_SECOND;

                    // Draw only if within bounds (considering radius)
                    if (y >= -5 && y <= height + 5) {
                        graphics.drawCircle(x, y, 2.5);
                    }
                }
            });
            graphics.endFill();
        });

        // Draw Solution Line
        const { selectedTrackerId } = useSubmarineStore.getState();
        const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

        if (selectedTracker && selectedTracker.solution && selectedTracker.solution.anchorTime !== undefined) {
             const solution = selectedTracker.solution;

             graphics.lineStyle(2, 0xffffff, 0.8);

             // Draw from "Now" downwards into history
             // 1. Current Point
             const currentOwnShip = {
                 x: useSubmarineStore.getState().x,
                 y: useSubmarineStore.getState().y,
                 heading: useSubmarineStore.getState().heading
             };

             const targetPosNow = calculateTargetPosition(solution as any, gameTime);
             const dxNow = targetPosNow.x - currentOwnShip.x;
             const dyNow = targetPosNow.y - currentOwnShip.y;
             let trueBearingNow = Math.atan2(dxNow, dyNow) * (180 / Math.PI);
             trueBearingNow = normalizeAngle(trueBearingNow);
             const relBearingNow = normalizeAngle(trueBearingNow - currentOwnShip.heading);
             let signedRelNow = relBearingNow;
             if (signedRelNow > 180) signedRelNow -= 360;
             const xNow = ((signedRelNow + 150) / 300) * width;

             graphics.moveTo(xNow, 0);
             let lastX = xNow;

             // 2. History Points (Newest to Oldest)
             for (let i = selectedTracker.bearingHistory.length - 1; i >= 0; i--) {
                const h = selectedTracker.bearingHistory[i];
                const age = gameTime - h.time;
                const y = age * PIXELS_PER_SECOND;

                if (y > height + 5) continue;

                // Find ownship state
                const ownShipState = ownShipHistory.find(os => Math.abs(os.time - h.time) < 0.1);

                if (ownShipState) {
                    const targetPos = calculateTargetPosition(solution as any, h.time);

                    const dx = targetPos.x - ownShipState.x;
                    const dy = targetPos.y - ownShipState.y;

                    let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                    trueBearing = normalizeAngle(trueBearing);

                    const relBearing = normalizeAngle(trueBearing - ownShipState.heading);

                    let signedRel = relBearing;
                    if (signedRel > 180) signedRel -= 360;

                     const x = ((signedRel + 150) / 300) * width;

                     // Check for wrap (crossing stern 180)
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
    const draw = useMemo(() => (g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(1, 0x005500, 0.5); // Brighter green

        // Vertical lines (Bearing)
        // Range -150 to +150.
        // Step every 30 degrees
        for (let b = -150; b <= 150; b += 30) {
            const x = ((b + 150) / 300) * width;
            g.moveTo(x, 0);
            g.lineTo(x, height);
        }

        // Horizontal lines (Time)
        for (let y = 0; y <= height; y += 50) {
            g.moveTo(0, y);
            g.lineTo(width, y);
        }
    }, [width, height]);

    return <Graphics draw={draw} />;
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
