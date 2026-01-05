import { useRef, useMemo, useEffect, useState } from 'react';
import { Stage, Container, Sprite, Text, Graphics, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';

interface DimensionProps {
    width: number;
    height: number;
}

// Waterfall component to handle the shifting texture logic
const Waterfall = ({ width, height }: DimensionProps) => {
    const app = useApp();

    // Use useRef to hold the render texture so it persists across renders
    const spriteRef = useRef<PIXI.Sprite | null>(null);

    // Graphics object for drawing the new line
    const lineGraphics = useMemo(() => new PIXI.Graphics(), []);

    // Ping-pong render textures
    const rtA = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const rtB = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const currentRtIndex = useRef(0);

    // Effect to recreate textures if dimensions change
    useEffect(() => {
        // Destroy old textures
        rtA.current.destroy(true);
        rtB.current.destroy(true);

        // Create new ones
        rtA.current = PIXI.RenderTexture.create({ width, height });
        rtB.current = PIXI.RenderTexture.create({ width, height });

        // Reset sprite texture
        if (spriteRef.current) {
            spriteRef.current.texture = rtA.current;
        }

    }, [width, height]);

    const designateTracker = useSubmarineStore(state => state.designateTracker);

    // Cleanup textures on unmount (only once)
    useEffect(() => {
        return () => {
             // We don't want to destroy if just resizing, but here we do simple destroy/recreate in the other effect.
             // But on unmount we should clean up.
             // We rely on the other effect to manage RT lifecycle during resize.
             // This cleanup is for component unmount.
             // However, React strict mode or rapid updates might cause issues if we double destroy.
             // Let's trust PIXI's garbage collection or handle it carefully.
        };
    }, []);

    useTick((_delta) => {
        if (!app) return;

        const currentRt = currentRtIndex.current === 0 ? rtA.current : rtB.current;
        const nextRt = currentRtIndex.current === 0 ? rtB.current : rtA.current;

        // Check if textures are valid
        if (!currentRt.valid || !nextRt.valid) return;

        // Create a sprite from the current state (previous frame)
        const prevSprite = new PIXI.Sprite(currentRt);
        prevSprite.y = 1; // Shift down

        // Create the new line
        lineGraphics.clear();

        // Draw simulated random noise data for the line (Background noise)
        for (let x = 0; x < width; x+=2) {
             // Phosphor green varying opacity
             const intensity = Math.random();
             if (intensity > 0.8) {
                 lineGraphics.beginFill(0x33ff33, intensity * 0.8);
                 lineGraphics.drawRect(x, 0, 2, 1);
                 lineGraphics.endFill();
             }
        }

        // Draw Sensor Contacts
        // Access store state directly to avoid re-renders
        const { sensorReadings } = useSubmarineStore.getState();

        sensorReadings.forEach((reading) => {
            // Map bearing to X coordinate.
            // Center (width/2) is 0 degrees (Dead Ahead).
            // Left edge (0% X) is 210 Relative (-150).
            // Right edge (100% X) is 150 Relative (+150).
            // Total span = 300 degrees.

            let signedBearing = reading.bearing;
            if (signedBearing > 180) signedBearing -= 360;

            // Check if visible (within -150 to +150)
            if (signedBearing >= -150 && signedBearing <= 150) {
                 const x = ((signedBearing + 150) / 300) * width;

                 lineGraphics.beginFill(0xccffcc, 1.0);
                 lineGraphics.drawRect(x, 0, 4, 3);
                 lineGraphics.endFill();
            }
        });

        // Render previous frame shifted down to next texture
        app.renderer.render(prevSprite, {
            renderTexture: nextRt,
            clear: true
        });

        // Render new line on top
        app.renderer.render(lineGraphics, {
            renderTexture: nextRt,
            clear: false // Do not clear, draw on top
        });

        // Swap
        currentRtIndex.current = 1 - currentRtIndex.current;

        // Update the visible sprite
        if (spriteRef.current) {
            spriteRef.current.texture = nextRt;
        }

        // Cleanup created sprite to avoid memory leak?
        prevSprite.destroy({ children: true, texture: false, baseTexture: false });
    });

    return (
        <Sprite
            ref={spriteRef}
            texture={rtA.current}
            eventMode="static"
            pointerdown={(e) => {
                if (!e.currentTarget) return;
                const localPoint = e.currentTarget.toLocal(e.global);
                const x = localPoint.x;

                // Inverse Formula:
                // x = ((signedBearing + 150) / 300) * width
                // signedBearing + 150 = (x / width) * 300
                // signedBearing = (x / width) * 300 - 150

                const signedBearing = (x / width) * 300 - 150;

                let bearing = signedBearing;
                if (bearing < 0) bearing += 360;

                designateTracker(bearing);
            }}
        />
    );
};

const NoiseBackground = ({ width, height }: DimensionProps) => {
    // A simple static noise background
    const noiseTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; // Generate at fixed resolution and scale, or regenerate? Regenerate is safer for quality.
        // Actually, let's regenerate if dimensions change drastically, but for noise, scaling is fine.
        // For now, let's just make it dynamic.
        canvas.width = width || 100;
        canvas.height = height || 100;

        const ctx = canvas.getContext('2d');
        if (ctx) {
             ctx.fillStyle = '#000000';
             ctx.fillRect(0,0, width, height);
             // random noise
             for(let i=0; i<width*height*0.05; i++) {
                 const x = Math.random() * width;
                 const y = Math.random() * height;
                 ctx.fillStyle = 'rgba(51, 255, 51, 0.1)'; // Faint phosphor green
                 ctx.fillRect(x,y,1,1);
             }
        }
        return PIXI.Texture.from(canvas);
    }, [width, height]);

    return <Sprite texture={noiseTexture} />;
};

interface SolutionOverlayProps extends DimensionProps {
    visible: boolean;
}

const SolutionOverlay = ({ width, height, visible }: SolutionOverlayProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        if (!visible) return;

        const store = useSubmarineStore.getState();
        const { trackers, selectedTrackerId, ownShipHistory, gameTime, x: currentX, y: currentY, heading: currentHeading } = store;

        if (!selectedTrackerId) return;
        const selectedTracker = trackers.find(t => t.id === selectedTrackerId);
        if (!selectedTracker || !selectedTracker.solution) return;

        const solution = selectedTracker.solution;

        // Settings
        const STEP_Y = 5; // Calculate every 5 pixels

        graphics.lineStyle(2, 0xffffff, 0.5);

        let firstPoint = true;

        // Helper to interpolate ownship history
        const getInterpolatedOwnShip = (time: number): { x: number, y: number, heading: number } | null => {
            // If time is future (shouldn't happen with history logic), return current
            if (time >= gameTime) {
                return { x: currentX, y: currentY, heading: currentHeading };
            }

            // Find history points surrounding 'time'
            // ownShipHistory is ordered oldest to newest
            // We search from end backwards
            for (let i = ownShipHistory.length - 1; i >= 0; i--) {
                const h1 = ownShipHistory[i];
                if (h1.time <= time) {
                    // h1 is just before or at time.
                    // h2 (the next one) is just after time.

                    // If h1 is the last element, and time < gameTime, then we are between h1 and current state?
                    // Wait, ownShipHistory is pushed every 60 ticks.
                    // Between last history and now is the "live" gap.

                    let h2: { time: number, x: number, y: number, heading: number };
                    if (i === ownShipHistory.length - 1) {
                        h2 = { time: gameTime, x: currentX, y: currentY, heading: currentHeading };
                    } else {
                        h2 = ownShipHistory[i + 1];
                    }

                    // Interpolate between h1 and h2
                    const range = h2.time - h1.time;
                    if (range <= 0.0001) return h1; // Avoid divide by zero

                    const t = (time - h1.time) / range; // 0 to 1

                    const x = h1.x + (h2.x - h1.x) * t;
                    const y = h1.y + (h2.y - h1.y) * t;

                    // Angular interpolation for heading
                    // Use getShortestAngle to find diff
                    const diff = getShortestAngle(h2.heading, h1.heading);
                    const heading = normalizeAngle(h1.heading + diff * t);

                    return { x, y, heading };
                }
            }

            // If time is older than oldest history
            if (ownShipHistory.length > 0) {
                 // Clamp to oldest? Or return null?
                 // If we return null, the line stops.
                 return null;
            }

            // Fallback if no history but we have current state
            return { x: currentX, y: currentY, heading: currentHeading };
        };

        for (let y = 0; y <= height; y += STEP_Y) {
            const timeOffset = y / 60; // 1 pixel = 1 tick = 1/60th sec
            const timeAtY = gameTime - timeOffset;

            const ownShip = getInterpolatedOwnShip(timeAtY);
            if (!ownShip) {
                // Out of history range, stop drawing
                break;
            }

            // Calculate solution position at this time
            const targetPos = calculateTargetPosition(solution, timeAtY);

            // Calculate Relative Bearing
            const dx = targetPos.x - ownShip.x;
            const dy = targetPos.y - ownShip.y;

            // True Bearing to Target
            // Math.atan2(dx, dy) gives angle from +Y (North)
            let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
            trueBearing = normalizeAngle(trueBearing);

            // Relative Bearing
            // Rel = True - OwnHeading
            // e.g. True 090, Head 000 -> Rel 090
            // e.g. True 000, Head 090 -> Rel -090 (270)
            const relBearing = getShortestAngle(trueBearing, ownShip.heading);

            // Check visibility (-150 to +150)
            if (relBearing >= -150 && relBearing <= 150) {
                 const x = ((relBearing + 150) / 300) * width;

                 if (firstPoint) {
                     graphics.moveTo(x, y);
                     firstPoint = false;
                 } else {
                     // Check for wrap-around artifacts (if it jumped from left to right)
                     // Since we check bounds -150 to 150, there shouldn't be a wrap unless it crossed the rear 60 deg blind spot.
                     // If it crossed the blind spot, relBearing would go outside [-150, 150].
                     // But we are inside the 'if'.
                     // Wait, if consecutive points are valid but separated by the blind spot?
                     // E.g. 150 -> 210 (invalid) -> -150.
                     // The loop would skip the invalid ones, and connect 150 to -150. That's a huge line across the screen.
                     // We should check distance from previous point.
                     // Screen width is 'width'.
                     // If distance > width / 2, probably a wrap/jump.

                     // Get previous position? Graphics api doesn't expose easily.
                     // We trust that small STEP_Y means small changes.
                     // A jump across the screen means crossing the baffles.
                     // But we only draw if INSIDE baffles.
                     // If we skipped points, 'lineTo' will connect across the gap.
                     // We need to 'moveTo' if we had a gap.

                     // Optimization: Track 'lastValidY'.
                     // If y - lastValidY > STEP_Y * 2, then we had a gap.
                     // But I'm local variables inside loop.
                     // Actually, if we just check visibility:
                     // If invalid, we set firstPoint = true (so next valid point is a moveTo).

                     graphics.lineTo(x, y);
                 }
            } else {
                firstPoint = true;
            }
        }
    });

    return <Graphics ref={graphicsRef} />;
};

const TrackerOverlay = ({ width }: { width: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();

        // Access store directly
        const { trackers } = useSubmarineStore.getState();

        trackers.forEach((tracker) => {
             // Map bearing to X coordinate.
             let signedBearing = tracker.currentBearing;
             if (signedBearing > 180) signedBearing -= 360;

             if (signedBearing >= -150 && signedBearing <= 150) {
                 const x = ((signedBearing + 150) / 300) * width;

                 // Draw a triangle pointing down at the top
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
                        style={
                            new PIXI.TextStyle({
                                fill: '#33ff33',
                                fontSize: 14,
                                fontFamily: 'monospace',
                                fontWeight: 'bold'
                            })
                        }
                     />
                 );
            })}
        </Container>
    );
};

const SonarDisplay = () => {
    const { ref, width, height } = useResize();
    const [showSolution, setShowSolution] = useState(true);

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
                        <NoiseBackground width={width} height={height} />
                        <Waterfall width={width} height={height} />
                        <SolutionOverlay width={width} height={height} visible={showSolution} />
                        <TrackerOverlay width={width} />
                    </Container>
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
