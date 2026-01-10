import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Container, Sprite, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle, FEET_PER_KNOT_SEC, YARDS_TO_FEET } from '../../lib/tma';
import type { Tracker, SolutionLeg, TrackerSolution } from '../../store/types';

interface PEPDisplayProps {
    width: number;
    height: number;
    onGhostSolution: (solution: TrackerSolution | null) => void;
}

const GRID_SIZE = 80; // 80x80 grid
const MAX_RANGE = 40000;
const STEP = MAX_RANGE / GRID_SIZE; // 500 yards

const PEPDisplay = ({ width, height, onGhostSolution }: PEPDisplayProps) => {
    const { selectedTrackerId, trackers, ownShipHistory, gameTime } = useSubmarineStore();
    const workerRef = useRef<Worker | null>(null);
    const [gridData, setGridData] = useState<Float32Array | null>(null);
    const [calculating, setCalculating] = useState(false);
    const textureRef = useRef<PIXI.Texture | null>(null);
    const [hoverPos, setHoverPos] = useState<{ r1: number, r2: number } | null>(null);
    const [ranges, setRanges] = useState({ r1: 0, r2: 0 }); // Current best solution R1/R2?

    // Refs for current solving context to avoid closure staleness in event handlers
    const contextRef = useRef<{
        t1: number, t2: number, b1: number, b2: number, os1: any
    } | null>(null);

    useEffect(() => {
        // Init Worker
        const worker = new Worker(new URL('../../workers/TMASolver.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
            const { grid } = e.data;
            setGridData(grid);
            setCalculating(false);
        };
        workerRef.current = worker;
        return () => worker.terminate();
    }, []);

    // Trigger Calculation when Tracker/Leg changes
    useEffect(() => {
        if (!selectedTrackerId || !workerRef.current) return;
        const tracker = trackers.find(t => t.id === selectedTrackerId);
        if (!tracker || !tracker.solution.legs.length) return;

        // Determine T1, T2 based on Active Leg
        // We use the last leg for R1-R2 analysis typically, or allow user selection.
        // For simplicity, we analyze the *current active leg*.
        const legs = tracker.solution.legs;
        const activeLeg = legs[legs.length - 1];

        const t1 = activeLeg.startTime;
        const t2 = gameTime; // End at current time? Or defined end?

        // If leg duration is too short, we can't solve well.
        if (t2 - t1 < 30) return; // Wait for 30s of data

        // Get Bearings B1, B2 from History
        // Interpolate or find nearest
        // We need TRUE bearings for the Solver
        // Helper to get true bearing from history
        const getTrueBearing = (t: number) => {
             // Find history point
             const h = tracker.bearingHistory.find(h => Math.abs(h.time - t) < 1.0); // Simple exact match approx
             // Better: Interpolate or use nearest.
             // Let's grab nearest.
             let nearest = tracker.bearingHistory[0];
             let minDiff = 99999;
             for (const item of tracker.bearingHistory) {
                 const d = Math.abs(item.time - t);
                 if (d < minDiff) { minDiff = d; nearest = item; }
             }

             if (!nearest) return 0;

             // Find OwnShip at that time to convert Relative to True
             let os = ownShipHistory[0];
             let minOsDiff = 99999;
             for (const item of ownShipHistory) {
                 const d = Math.abs(item.time - nearest.time);
                 if (d < minOsDiff) { minOsDiff = d; os = item; }
             }

             return normalizeAngle(nearest.bearing + os.heading);
        };

        const b1 = getTrueBearing(t1);
        const b2 = getTrueBearing(t2);

        // Store context for Ghost Trace calculation
        // We need OS1 to project from
        const os1 = ownShipHistory.find(os => Math.abs(os.time - t1) < 1.0) || ownShipHistory[ownShipHistory.length - 1];

        contextRef.current = { t1, t2, b1, b2, os1 };

        setCalculating(true);
        workerRef.current.postMessage({
            t1, t2, b1, b2,
            bearingHistory: tracker.bearingHistory,
            ownShipHistory: ownShipHistory,
            config: {
                r1Start: 0, r1End: MAX_RANGE, r1Step: STEP,
                r2Start: 0, r2End: MAX_RANGE, r2Step: STEP
            }
        });

    }, [selectedTrackerId, trackers, gameTime, ownShipHistory]); // Throttle this? R1-R2 usually manual refresh.

    // Update Texture from Grid Data
    useEffect(() => {
        if (!gridData) return;

        // Create RGBA buffer
        const buffer = new Uint8Array(GRID_SIZE * GRID_SIZE * 4);

        for (let i = 0; i < gridData.length; i++) {
            const val = gridData[i];
            const rIdx = i * 4;

            if (val === -1) {
                // Invalid (Red)
                buffer[rIdx] = 255;     // R
                buffer[rIdx + 1] = 0;   // G
                buffer[rIdx + 2] = 0;   // B
                buffer[rIdx + 3] = 100; // A
            } else {
                // RMS Value
                // 0 (Blue) -> 5 (Red)
                // Map 0-5 to Gradient
                // 0-1: Blue to Green
                // 1-3: Green to Yellow
                // 3-5: Yellow to Red

                let r=0, g=0, b=0;

                if (val < 1.0) {
                    // Blue -> Green
                    const t = val; // 0..1
                    r = 0;
                    g = Math.floor(255 * t);
                    b = Math.floor(255 * (1 - t)); // Fade out blue? Or Keep blue?
                    // Better: Blue (0,0,255) -> Cyan (0,255,255) -> Green (0,255,0)
                    // Let's simple:
                    // 0.0: 0, 0, 255
                    // 0.5: 0, 128, 255
                    // 1.0: 0, 255, 0
                    if (val < 0.5) {
                        b = 255;
                        g = Math.floor(255 * (val * 2));
                    } else {
                        g = 255;
                        b = Math.floor(255 * (2 - val * 2));
                    }
                } else if (val < 5.0) {
                    // Green -> Red
                    const t = (val - 1.0) / 4.0;
                    r = Math.floor(255 * t);
                    g = Math.floor(255 * (1 - t));
                    b = 0;
                } else {
                    // Saturated Red
                    r = 255; g = 0; b = 0;
                }

                buffer[rIdx] = r;
                buffer[rIdx + 1] = g;
                buffer[rIdx + 2] = b;
                buffer[rIdx + 3] = 255;
            }
        }

        const texture = PIXI.Texture.fromBuffer(buffer, GRID_SIZE, GRID_SIZE, {
            scaleMode: PIXI.SCALE_MODES.NEAREST
        });
        textureRef.current = texture;

    }, [gridData]);

    // Input Handling
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!contextRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Map x/y to R1/R2
        // X -> R1, Y -> R2? Or Y inverted?
        // Let's assume (0,0) is top-left = R1=0, R2=40k?
        // Usually graphs are Y-up. So (0, height) is (0,0).
        // Let's map Y from bottom.

        const r1 = (x / width) * MAX_RANGE;
        const r2 = ((height - y) / height) * MAX_RANGE;

        setHoverPos({ r1, r2 });

        // Calculate Ghost Solution
        const { t1, t2, b1, b2, os1 } = contextRef.current;
        const dt = t2 - t1;
        if (dt <= 0) return;

        const rad1 = (b1 * Math.PI) / 180;
        const rad2 = (b2 * Math.PI) / 180;

        const p1x = os1.x + r1 * YARDS_TO_FEET * Math.sin(rad1);
        const p1y = os1.y + r1 * YARDS_TO_FEET * Math.cos(rad1);

        // We need P2 to get velocity
        // We don't have OS2 here easily unless we stored it.
        // But we just need Course/Speed.
        // Actually we need P2 which depends on R2 and B2.
        // We can approximate or just pass R1/R2 to parent and let parent calc?
        // No, parent doesn't have B1/B2 context easily.
        // Let's re-find OS2.

        // Optimization: contextRef should hold OS2 too.
        // But for now let's skip strict accuracy or assume OS doesn't move much? No.
        // Let's just dispatch partial data or fetch OS2 from store in the loop (slow).
        // Actually, store state is available via hook, but inside event handler...
        // We can access `useSubmarineStore.getState()`.

        const store = useSubmarineStore.getState();
        const os2 = store.ownShipHistory.find(os => Math.abs(os.time - t2) < 1.0) || store.ownShipHistory[0];

        const p2x = os2.x + r2 * YARDS_TO_FEET * Math.sin(rad2);
        const p2y = os2.y + r2 * YARDS_TO_FEET * Math.cos(rad2);

        const vx = (p2x - p1x) / dt;
        const vy = (p2y - p1y) / dt;

        const speedKts = Math.sqrt(vx*vx + vy*vy) / FEET_PER_KNOT_SEC;
        const course = normalizeAngle(Math.atan2(vx, vy) * 180 / Math.PI);

        const ghostLeg: SolutionLeg = {
            startTime: t1,
            startRange: r1,
            startBearing: b1, // True Bearing!
            course,
            speed: speedKts,
            startOwnShip: os1 // We need full OS state
        };

        const ghostSolution: TrackerSolution = {
            legs: [ghostLeg],
            speed: speedKts,
            range: r1, // At start
            course,
            bearing: b1,
            anchorTime: t1,
            anchorOwnShip: os1,
            computedWorldX: p1x,
            computedWorldY: p1y
        };

        onGhostSolution(ghostSolution);
    };

    const handlePointerLeave = () => {
        setHoverPos(null);
        onGhostSolution(null);
    };

    return (
        <div className="relative w-full h-full bg-gray-900 border-r border-gray-700"
             onPointerMove={handlePointerMove}
             onPointerLeave={handlePointerLeave}
        >
            {/* Header / Info */}
            <div className="absolute top-0 left-0 p-2 text-xs font-mono text-green-500 z-10 bg-black/50 pointer-events-none">
                <div>R1-R2 SOLVER</div>
                {hoverPos && (
                    <>
                    <div>R1: {Math.round(hoverPos.r1)} yds</div>
                    <div>R2: {Math.round(hoverPos.r2)} yds</div>
                    </>
                )}
                {calculating && <div className="text-yellow-400">CALCULATING...</div>}
            </div>

            {/* PIXI Canvas */}
            <Stage width={width} height={height} options={{ background: 0x000000 }}>
                {textureRef.current && (
                    <Sprite
                        texture={textureRef.current}
                        width={width}
                        height={height}
                        scale={{ x: 1, y: -1 }}
                        anchor={[0, 0]}
                        position={[0, height]}
                    />
                )}

                {/* Axes Labels */}
                {/* We can draw them with PIXI Text or overlay HTML. HTML is easier. */}
            </Stage>

            {/* Overlay Labels (HTML) */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-500">R1 (START)</div>
            <div className="absolute top-2 right-2 text-xs text-gray-500 transform rotate-90 origin-top-right">R2 (END)</div>
        </div>
    );
};

export default PEPDisplay;
