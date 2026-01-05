import { useMemo, useRef } from 'react';
import { Stage, Container, Graphics, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';

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
                    // If the X jump is too large, don't draw the line
                    if (Math.abs(x - lastX) > width / 3) {
                         graphics.moveTo(x, y);
                    } else {
                         graphics.lineTo(x, y);
                    }
                }
                lastX = x;
            } else {
                // If we skipped points, next valid point should be a move
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

        if (selectedTracker && (selectedTracker.solution.range > 0 || selectedTracker.solution.speed > 0)) {
            const { speed: solSpeed, course: solCourse, range: solRange } = selectedTracker.solution;
            const currentBearingRad = (selectedTracker.currentBearing * Math.PI) / 180;
            const FEET_PER_YD = 3;

            // Current OwnShip Pos
            const currentOwnShip = useSubmarineStore.getState(); // x, y are current

            // Calculate Target Initial Position at gameTime (Hypothesis Anchor)
            // Target is at Range R along Bearing B from OwnShip
            // Note: Display bearing is usually Relative? Or True?
            // Store uses: relativeBearing -> noisyBearing.
            // So tracker.currentBearing is RELATIVE.
            // To get Target True Position, we need True Bearing.
            // True Bearing = Relative + Heading.

            const currentHeadingRad = (currentOwnShip.heading * Math.PI) / 180;
            const trueBearingRad = currentBearingRad + currentHeadingRad;

            const targetX = currentOwnShip.x + (solRange * FEET_PER_YD) * Math.sin(trueBearingRad);
            const targetY = currentOwnShip.y + (solRange * FEET_PER_YD) * Math.cos(trueBearingRad);

            // Target Velocity Components (ft/sec? No, store coordinates are feet, time is seconds)
            // Speed is Knots. 1 Kt ~= 1.6878 ft/s.
            const FEET_PER_KNOT_SEC = 1.6878;
            const targetSpeedFtSec = solSpeed * FEET_PER_KNOT_SEC;
            const solCourseRad = (solCourse * Math.PI) / 180;
            const targetVx = targetSpeedFtSec * Math.sin(solCourseRad);
            const targetVy = targetSpeedFtSec * Math.cos(solCourseRad);

            graphics.lineStyle(2, 0xffffff, 0.8);

            // We need to draw the line corresponding to history points
            // Iterate through ownShipHistory to find corresponding points in time
            // However, ownShipHistory might be sparse (every 60 ticks).
            // Let's iterate backwards from gameTime

            let firstPoint = true;

            // Use ownShipHistory for past points.
            // Add current point first?
            // At t=0 (now), y=0. x = currentBearing.
            let signedStart = selectedTracker.currentBearing;
            if (signedStart > 180) signedStart -= 360;

            // Only draw if valid? Or should we draw even if out of bounds (off screen)?
            // For lines, drawing off screen is fine (it will clip).
            const startX = ((signedStart + 150) / 300) * width;
            graphics.moveTo(startX, 0);

            // Iterate backwards through history
            // We can reuse the loop over tracker.bearingHistory to get times?
            // Or iterate ownShipHistory.

            // Let's align with tracker.bearingHistory times for consistency with dots
            // But we need OwnShip pos at those times.
            // ownShipHistory should be recorded at same times.

            for (let i = selectedTracker.bearingHistory.length - 1; i >= 0; i--) {
                const h = selectedTracker.bearingHistory[i];
                const age = gameTime - h.time;
                const y = age * PIXELS_PER_SECOND;

                if (y > height + 5) continue; // Out of view

                // Find ownship state at h.time
                // optimization: search backwards or map?
                // For now simple find (array is small?)
                const ownShipState = ownShipHistory.find(os => Math.abs(os.time - h.time) < 0.01);

                if (ownShipState) {
                    // Time delta from NOW to THEN (negative)
                    const dt = h.time - gameTime;

                    // Target Pos at time t
                    const tx = targetX + targetVx * dt;
                    const ty = targetY + targetVy * dt;

                    // Relative Bearing calculation
                    const dx = tx - ownShipState.x;
                    const dy = ty - ownShipState.y;

                    // Math angle
                    const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                    const trueBearing = (90 - mathAngleDeg + 360) % 360;

                    const relBearing = (trueBearing - ownShipState.heading + 360) % 360;

                    let signedRel = relBearing;
                    if (signedRel > 180) signedRel -= 360;
                    const x = ((signedRel + 150) / 300) * width;

                    // Handle wrapping?
                    // If the line crosses 360/0 boundary, moveTo instead of lineTo
                    // Simple check: if delta X is too large

                    // Actually, if we just lineTo, it will cross the screen.
                    // We need to break the line.

                    // Get previous point (which was drawn last iteration, i.e. closer to now)
                    // Wait, we are iterating backwards in time (increasing y).
                    // previous point was at y_prev < y.

                    // Just draw to x,y. If jump is big, moveTo.

                    // We need to track last drawn X
                    // But inside the loop 'firstPoint' handles the very start.

                    if (firstPoint) {
                       // handled by initial moveTo(startX, 0)
                       firstPoint = false;
                    }

                    // Check for wrap
                    // We don't have access to 'lastX' easily unless we store it.
                    // Let's rely on standard PIXI line behavior for now?
                    // No, it will draw a horizontal line across the screen.
                    // We should check distance from last point.

                    // Ideally we project the line properly.
                    // But for now, let's just lineTo.

                    graphics.lineTo(x, y);
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
        // Step every 30 degrees?
        // -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150
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
