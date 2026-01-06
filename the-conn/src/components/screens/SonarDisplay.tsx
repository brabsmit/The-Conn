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

    // Graphics object for drawing the new line
    const lineGraphics = useMemo(() => new PIXI.Graphics(), []);

    // Triple Buffers
    // FAST: 100ms
    const rtFastA = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const rtFastB = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const idxFast = useRef(0);
    const accFast = useRef(0);

    // MED: 1000ms
    const rtMedA = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const rtMedB = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const idxMed = useRef(0);
    const accMed = useRef(0);

    // SLOW: 3000ms
    const rtSlowA = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const rtSlowB = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const idxSlow = useRef(0);
    const accSlow = useRef(0);

    // Visible Sprite
    const spriteRef = useRef<PIXI.Sprite | null>(null);

    // Effect to recreate textures if dimensions change
    useEffect(() => {
        // Destroy old textures
        const textures = [rtFastA, rtFastB, rtMedA, rtMedB, rtSlowA, rtSlowB];
        textures.forEach(rt => rt.current.destroy(true));

        // Create new ones
        rtFastA.current = PIXI.RenderTexture.create({ width, height });
        rtFastB.current = PIXI.RenderTexture.create({ width, height });
        rtMedA.current = PIXI.RenderTexture.create({ width, height });
        rtMedB.current = PIXI.RenderTexture.create({ width, height });
        rtSlowA.current = PIXI.RenderTexture.create({ width, height });
        rtSlowB.current = PIXI.RenderTexture.create({ width, height });

        // Reset sprite texture
        if (spriteRef.current) {
            spriteRef.current.texture = rtFastA.current;
        }

    }, [width, height]);

    const designateTracker = useSubmarineStore(state => state.designateTracker);

    useTick((delta) => {
        if (!app) return;

        // Common update logic
        const updateBuffer = (
            rtA: PIXI.RenderTexture,
            rtB: PIXI.RenderTexture,
            idxRef: React.MutableRefObject<number>
        ) => {
            const currentRt = idxRef.current === 0 ? rtA : rtB;
            const nextRt = idxRef.current === 0 ? rtB : rtA;

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
            const { sensorReadings, torpedoes, x: ownX, y: ownY, heading: ownHeading } = useSubmarineStore.getState();

            sensorReadings.forEach((reading) => {
                let signedBearing = reading.bearing;
                if (signedBearing > 180) signedBearing -= 360;

                if (signedBearing >= -150 && signedBearing <= 150) {
                     const x = ((signedBearing + 150) / 300) * width;
                     lineGraphics.beginFill(0xccffcc, 1.0);
                     lineGraphics.drawRect(x, 0, 4, 3);
                     lineGraphics.endFill();
                }
            });

            // Draw Torpedoes (Acoustic Signature)
            torpedoes.forEach((torp) => {
                if (torp.status !== 'RUNNING') return;

                const dx = torp.position.x - ownX;
                const dy = torp.position.y - ownY;

                // Calculate True Bearing (Nav convention: 0 is North)
                // atan2(dy, dx) gives angle from East (+X)
                // Nav Bearing = 90 - MathAngle
                const mathAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                const trueBearing = normalizeAngle(90 - mathAngleDeg);

                const relBearing = getShortestAngle(trueBearing, ownHeading);

                if (relBearing >= -150 && relBearing <= 150) {
                     const x = ((relBearing + 150) / 300) * width;

                     // Higher Brightness (White)
                     lineGraphics.beginFill(0xFFFFFF, 1.0);
                     lineGraphics.drawRect(x, 0, 3, 3);
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
            idxRef.current = 1 - idxRef.current;
            prevSprite.destroy({ children: true, texture: false, baseTexture: false });
        };

        // --- FAST UPDATE ---
        accFast.current += delta;
        const threshFast = 100 / 16.66;
        if (accFast.current >= threshFast) {
            accFast.current = 0;
            updateBuffer(rtFastA.current, rtFastB.current, idxFast);
        }

        // --- MED UPDATE ---
        accMed.current += delta;
        const threshMed = 1000 / 16.66;
        if (accMed.current >= threshMed) {
            accMed.current = 0;
            updateBuffer(rtMedA.current, rtMedB.current, idxMed);
        }

        // --- SLOW UPDATE ---
        accSlow.current += delta;
        const threshSlow = 3000 / 16.66;
        if (accSlow.current >= threshSlow) {
            accSlow.current = 0;
            updateBuffer(rtSlowA.current, rtSlowB.current, idxSlow);
        }

        // --- DISPLAY SELECTION ---
        if (spriteRef.current) {
            const { timeScale } = useSubmarineStore.getState();
            let targetTexture;

            if (timeScale === 'FAST') {
                targetTexture = idxFast.current === 0 ? rtFastA.current : rtFastB.current; // Actually we want the ONE we just wrote to? No, the one that is currently "current" after swap?
                // In logic above:
                // current is A. Write to B. Swap idx to 1 (B).
                // So now idx is 1 (B). We want B.
                // Wait.
                // Start: idx=0. current=A. Write to B. Swap idx=1.
                // Next tick: idx=1. current=B. Write to A. Swap idx=0.
                // So if idx=0, it means last write was to A (which became current).
                // Yes.
                targetTexture = idxFast.current === 0 ? rtFastA.current : rtFastB.current;
            } else if (timeScale === 'MED') {
                targetTexture = idxMed.current === 0 ? rtMedA.current : rtMedB.current;
            } else {
                targetTexture = idxSlow.current === 0 ? rtSlowA.current : rtSlowB.current;
            }

            // Only update if changed to avoid flicker? Sprite handles it.
            spriteRef.current.texture = targetTexture;
        }
    });

    return (
        <Sprite
            ref={spriteRef}
            texture={rtFastA.current}
            eventMode="static"
            pointerdown={(e) => {
                if (!e.currentTarget) return;
                const localPoint = e.currentTarget.toLocal(e.global);
                const x = localPoint.x;
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
        const { trackers, selectedTrackerId, ownShipHistory, gameTime, x: currentX, y: currentY, heading: currentHeading, timeScale } = store;

        if (!selectedTrackerId) return;
        const selectedTracker = trackers.find(t => t.id === selectedTrackerId);
        if (!selectedTracker || !selectedTracker.solution) return;

        const solution = selectedTracker.solution;

        const STEP_Y = 5;

        // Pixels Per Second calculation
        let secondsPerPixel = 0.1;
        if (timeScale === 'MED') secondsPerPixel = 1.0;
        if (timeScale === 'SLOW') secondsPerPixel = 3.0;

        graphics.lineStyle(2, 0xffffff, 0.5);

        let firstPoint = true;

        const getInterpolatedOwnShip = (time: number): { x: number, y: number, heading: number } | null => {
            if (time >= gameTime) {
                return { x: currentX, y: currentY, heading: currentHeading };
            }

            for (let i = ownShipHistory.length - 1; i >= 0; i--) {
                const h1 = ownShipHistory[i];
                if (h1.time <= time) {
                    let h2: { time: number, x: number, y: number, heading: number };
                    if (i === ownShipHistory.length - 1) {
                        h2 = { time: gameTime, x: currentX, y: currentY, heading: currentHeading };
                    } else {
                        h2 = ownShipHistory[i + 1];
                    }

                    const range = h2.time - h1.time;
                    if (range <= 0.0001) return h1;

                    const t = (time - h1.time) / range;

                    const x = h1.x + (h2.x - h1.x) * t;
                    const y = h1.y + (h2.y - h1.y) * t;

                    const diff = getShortestAngle(h2.heading, h1.heading);
                    const heading = normalizeAngle(h1.heading + diff * t);

                    return { x, y, heading };
                }
            }

            if (ownShipHistory.length > 0) {
                 return null;
            }

            return { x: currentX, y: currentY, heading: currentHeading };
        };

        for (let y = 0; y <= height; y += STEP_Y) {
            const timeOffset = y * secondsPerPixel;
            const timeAtY = gameTime - timeOffset;

            const ownShip = getInterpolatedOwnShip(timeAtY);
            if (!ownShip) {
                break;
            }

            const targetPos = calculateTargetPosition(solution, timeAtY);

            const dx = targetPos.x - ownShip.x;
            const dy = targetPos.y - ownShip.y;

            let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
            trueBearing = normalizeAngle(trueBearing);

            const relBearing = getShortestAngle(trueBearing, ownShip.heading);

            if (relBearing >= -150 && relBearing <= 150) {
                 const x = ((relBearing + 150) / 300) * width;

                 if (firstPoint) {
                     graphics.moveTo(x, y);
                     firstPoint = false;
                 } else {
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
