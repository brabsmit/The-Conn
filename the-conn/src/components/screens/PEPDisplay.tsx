import React, { useEffect, useRef, useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { normalizeAngle, FEET_PER_KNOT_SEC, YARDS_TO_FEET } from '../../lib/tma';
import type { TrackerSolution, SolutionLeg } from '../../store/types';

interface PEPDisplayProps {
    width: number;
    height: number;
    onGhostSolution: (solution: TrackerSolution | null) => void;
}

const GRID_SIZE = 80; // 80x80 grid for solver resolution
const MAX_RANGE = 40000;
const STEP = MAX_RANGE / GRID_SIZE; // 500 yards

const PEPDisplay = ({ width, height, onGhostSolution }: PEPDisplayProps) => {
    const { selectedTrackerId, trackers, ownShipHistory, gameTime } = useSubmarineStore();
    const workerRef = useRef<Worker | null>(null);
    const [calculating, setCalculating] = useState(false);

    // Canvas Refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    // Double Buffering: Holds the last fully rendered frame
    const lastRenderedFrame = useRef<ImageBitmap | null>(null);

    // Interaction State
    const [hoverPos, setHoverPos] = useState<{ r1: number, r2: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Solving Context (to avoid stale closures in event handlers)
    const contextRef = useRef<{
        t1: number, t2: number, b1: number, b2: number, os1: any
    } | null>(null);

    // Draw Function: Clears and draws the last good frame + overlays
    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Heatmap (if available)
        if (lastRenderedFrame.current) {
            // We want Cartesian origin (0,0) at bottom-left.
            // Image (0,0) corresponds to R1=0, R2=0 (from Worker generation logic where y=0 is R2Start).
            // But standard Canvas draws Image(0,0) at Canvas(0,0) (Top-Left).
            // So we must flip Y to put R2=0 at Bottom.

            ctx.save();
            ctx.scale(1, -1);
            ctx.translate(0, -canvas.height);
            // Draw scaled to fill the canvas
            ctx.drawImage(lastRenderedFrame.current, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        // Draw Solution Box (Current Tracker State)
        if (selectedTrackerId && contextRef.current) {
             const tracker = trackers.find(t => t.id === selectedTrackerId);
             if (tracker && tracker.solution.legs.length) {
                 const leg = tracker.solution.legs[tracker.solution.legs.length - 1];
                 const t2 = gameTime;

                 // R1 is Start Range
                 const r1 = leg.startRange;

                 // R2 is projected range at T2
                 // Can reuse calculation logic or tma lib?
                 // Let's do simple projection based on current sol parameters
                 // But wait, if we are dragging, the store updates, so this should reflect live dragging!

                 // Project:
                 const dt = t2 - leg.startTime;
                 // Get Target World Pos at T2
                 const spdFt = leg.speed * FEET_PER_KNOT_SEC;
                 const crsRad = leg.course * Math.PI / 180;

                 // Anchor
                 const brgRad = leg.startBearing * Math.PI / 180;
                 const rngFt = leg.startRange * YARDS_TO_FEET;
                 const ax = leg.startOwnShip.x + rngFt * Math.sin(brgRad);
                 const ay = leg.startOwnShip.y + rngFt * Math.cos(brgRad);

                 const tx = ax + Math.sin(crsRad) * spdFt * dt;
                 const ty = ay + Math.cos(crsRad) * spdFt * dt;

                 // OS2
                 const os2 = contextRef.current.os1; // Fallback? No, we need OS2
                 // We can grab it from store or history
                 const store = useSubmarineStore.getState();
                 const actualOS2 = store.ownShipHistory.find(os => Math.abs(os.time - t2) < 1.0) || store.ownShipHistory[store.ownShipHistory.length - 1] || leg.startOwnShip;

                 const dx = tx - actualOS2.x;
                 const dy = ty - actualOS2.y;
                 const r2 = Math.sqrt(dx*dx + dy*dy) / YARDS_TO_FEET;

                 // Map to Screen
                 // x = (r1 / MAX_RANGE) * width
                 // y = height - (r2 / MAX_RANGE) * height
                 const sx = (r1 / MAX_RANGE) * width;
                 const sy = height - (r2 / MAX_RANGE) * height;

                 ctx.strokeStyle = 'black';
                 ctx.fillStyle = 'white';
                 ctx.lineWidth = 2;
                 ctx.beginPath();
                 ctx.rect(sx - 6, sy - 6, 12, 12);
                 ctx.fill();
                 ctx.stroke();
             }
        }
    };

    // Re-draw on resize or when calculating state changes (for spinner via React, or canvas overlay?)
    // The spinner is implemented as HTML overlay below, so we don't need to draw it on canvas.
    useEffect(() => {
        draw();
    }, [width, height, trackers, selectedTrackerId, gameTime]); // Added dependencies to redraw box

    useEffect(() => {
        // Init Worker
        const worker = new Worker(new URL('../../workers/TMASolver.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = async (e) => {
            const { grid, speedGrid } = e.data;

            // Double Buffering Logic:
            // 1. Create a temporary offscreen canvas (or simple detached canvas)
            // 2. Draw pixels
            // 3. Create ImageBitmap
            // 4. Update ref

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = GRID_SIZE;
            tempCanvas.height = GRID_SIZE;
            const tempCtx = tempCanvas.getContext('2d');

            if (tempCtx && grid) {
                const imgData = tempCtx.createImageData(GRID_SIZE, GRID_SIZE);
                const data = imgData.data;

                for (let i = 0; i < grid.length; i++) {
                    const val = grid[i];
                    const idx = i * 4;

                    if (val === -1) {
                        // Invalid/OutOfBounds -> Red/Transparent
                        data[idx] = 255;
                        data[idx+1] = 0;
                        data[idx+2] = 0;
                        data[idx+3] = 0; // Transparent to let background show? Or red? Let's use transparent/black
                    } else {
                        // Mapping RMS Error to Color
                        // 0 (Best) -> Blue/Green
                        // High Error -> Red

                        let r=0, g=0, b=0;
                        if (val < 1.0) {
                             // Blue -> Green
                             // 0.0: Blue
                             // 1.0: Green
                             const t = val;
                             if (t < 0.5) {
                                 // 0.0 -> 0.5: Blue -> Cyan
                                 b = 255;
                                 g = Math.floor(255 * (t * 2));
                             } else {
                                 // 0.5 -> 1.0: Cyan -> Green
                                 g = 255;
                                 b = Math.floor(255 * (2 - (t * 2)));
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

                        data[idx] = r;
                        data[idx+1] = g;
                        data[idx+2] = b;
                        data[idx+3] = 255;
                    }
                }

                tempCtx.putImageData(imgData, 0, 0);

                // Draw Speed Contours
                if (speedGrid) {
                    tempCtx.lineWidth = 0.5; // Will scale up with image
                    tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    tempCtx.setLineDash([1, 1]);

                    const thresholds = [5, 10, 15, 20, 25];

                    thresholds.forEach(threshold => {
                        tempCtx.beginPath();

                        // Vertical Scan
                        for (let y = 0; y < GRID_SIZE; y++) {
                            for (let x = 0; x < GRID_SIZE - 1; x++) {
                                const idx = y * GRID_SIZE + x;
                                const val1 = speedGrid[idx];
                                const val2 = speedGrid[idx + 1];

                                if ((val1 < threshold && val2 >= threshold) || (val1 >= threshold && val2 < threshold)) {
                                    // Linear interpolation for exact crossing
                                    const t = (threshold - val1) / (val2 - val1);
                                    const cx = x + t;

                                    // Draw a small segment?
                                    // Better: Connect points. But marching squares is complex.
                                    // Simple approach: Draw a dot or tiny vertical line at the crossing.
                                    // Since we scan dense grid (80x80), drawing small ticks creates a line effect.
                                    // Let's try drawing a line to the vertical neighbor's crossing if it exists?
                                    // Actually, simple "draw point" might be too faint.
                                    // Let's just draw a tiny horizontal segment centered on the crossing.
                                    tempCtx.moveTo(cx, y);
                                    tempCtx.lineTo(cx, y + 1);
                                }
                            }
                        }

                        // Horizontal Scan
                        for (let x = 0; x < GRID_SIZE; x++) {
                            for (let y = 0; y < GRID_SIZE - 1; y++) {
                                const idx = y * GRID_SIZE + x;
                                const nextIdx = (y + 1) * GRID_SIZE + x;
                                const val1 = speedGrid[idx];
                                const val2 = speedGrid[nextIdx];

                                if ((val1 < threshold && val2 >= threshold) || (val1 >= threshold && val2 < threshold)) {
                                    const t = (threshold - val1) / (val2 - val1);
                                    const cy = y + t;

                                    tempCtx.moveTo(x, cy);
                                    tempCtx.lineTo(x + 1, cy);
                                }
                            }
                        }

                        tempCtx.stroke();

                        // Label (Draw text on first valid point found to avoid clutter?)
                        // Skipping labels for now to keep it unobtrusive as requested "unobtrusively".
                        // White dashed lines are enough context.
                    });
                }

                try {
                    const bmp = await createImageBitmap(tempCanvas);
                    // Close the old bitmap to free memory
                    if (lastRenderedFrame.current) {
                        lastRenderedFrame.current.close();
                    }
                    lastRenderedFrame.current = bmp;
                    setCalculating(false);
                    draw(); // Swap buffer to screen
                } catch (err) {
                    console.error("Bitmap creation failed", err);
                    setCalculating(false);
                }
            }
        };

        workerRef.current = worker;
        return () => worker.terminate();
    }, []);

    // Trigger Calculation
    useEffect(() => {
        if (!selectedTrackerId || !workerRef.current) return;
        const tracker = trackers.find(t => t.id === selectedTrackerId);
        if (!tracker || !tracker.solution.legs.length) return;

        const legs = tracker.solution.legs;
        const activeLeg = legs[legs.length - 1];
        const t1 = activeLeg.startTime;
        const t2 = gameTime;

        if (t2 - t1 < 30) return;

        // Helper: Find nearest bearing history item
        const getTrueBearing = (t: number) => {
             let nearest = tracker.bearingHistory[0];
             let minDiff = 99999;
             for (const item of tracker.bearingHistory) {
                 const d = Math.abs(item.time - t);
                 if (d < minDiff) { minDiff = d; nearest = item; }
             }
             if (!nearest) return 0;

             // Find OwnShip at that time
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

        const os1 = ownShipHistory.find(os => Math.abs(os.time - t1) < 1.0) || ownShipHistory[ownShipHistory.length - 1];

        contextRef.current = { t1, t2, b1, b2, os1 };

        setCalculating(true);
        // Ensure UI updates 'Calculating' state immediately

        workerRef.current.postMessage({
            t1, t2, b1, b2,
            bearingHistory: tracker.bearingHistory,
            ownShipHistory: ownShipHistory,
            config: {
                r1Start: 0, r1End: MAX_RANGE, r1Step: STEP,
                r2Start: 0, r2End: MAX_RANGE, r2Step: STEP
            }
        });

    }, [selectedTrackerId, trackers, gameTime, ownShipHistory]); // Note: In real app, might want to debounce 'trackers' updates

    // Handle Input
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
         if (!selectedTrackerId) return;
         // Hit test? For now, anywhere starts drag if close?
         // Or strictly on box? "Hit Test: If click is within the White Box"
         // Let's do simple radius check around current solution
         const tracker = trackers.find(t => t.id === selectedTrackerId);
         if (!tracker) return;

         // Reuse calculation to find box pos...
         // Ideally should memoize or ref the box pos
         // But for now let's just assume if they click, they want to drag.
         // Actually, R1-R2 implies clicking ANYWHERE in the grid is a candidate solution.
         // Standard UI: Click-drag anywhere snaps solution to that point.
         // The prompt says "If click is within the White Box, initiate drag".
         // This implies we only drag if we grab the handle.

         // Let's implement strict hit test.
         // We need current box screen coords.
         const canvas = canvasRef.current;
         if (!canvas) return;

         const rect = e.currentTarget.getBoundingClientRect();
         const x = e.clientX - rect.left;
         const y = e.clientY - rect.top;

         // Calculate box center
         // ... (Duplicate logic from draw - should refactor but inline is safer for "one shot" change)
         const leg = tracker.solution.legs[tracker.solution.legs.length - 1];
         // ...
         const r1 = leg.startRange;

         // Project R2 logic again...
         // To simplify: We know R1. We need R2.
         // R2 is just distance from OS2 to Target at T2.
         const store = useSubmarineStore.getState();
         const t1 = leg.startTime;
         const t2 = gameTime;
         const dt = t2 - t1;
         const spdFt = leg.speed * FEET_PER_KNOT_SEC;
         const crsRad = leg.course * Math.PI / 180;
         const brgRad = leg.startBearing * Math.PI / 180;
         const rngFt = leg.startRange * YARDS_TO_FEET;
         const ax = leg.startOwnShip.x + rngFt * Math.sin(brgRad);
         const ay = leg.startOwnShip.y + rngFt * Math.cos(brgRad);
         const tx = ax + Math.sin(crsRad) * spdFt * dt;
         const ty = ay + Math.cos(crsRad) * spdFt * dt;
         const actualOS2 = store.ownShipHistory.find(os => Math.abs(os.time - t2) < 1.0) || store.ownShipHistory[store.ownShipHistory.length - 1] || leg.startOwnShip;
         const dx = tx - actualOS2.x;
         const dy = ty - actualOS2.y;
         const calcR2 = Math.sqrt(dx*dx + dy*dy) / YARDS_TO_FEET;

         const boxX = (r1 / MAX_RANGE) * width;
         const boxY = height - (calcR2 / MAX_RANGE) * height;

         const dist = Math.sqrt((x - boxX)**2 + (y - boxY)**2);
         if (dist < 20) { // Generous hit area (20px radius)
             setIsDragging(true);
             e.currentTarget.setPointerCapture(e.pointerId);
         }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!contextRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Coordinate Scaling Fix:
        // x=0 -> R1=0. x=width -> R1=MAX
        // y=height -> R2=0. y=0 -> R2=MAX (since origin is bottom-left)

        const r1 = (x / rect.width) * MAX_RANGE;
        const r2 = ((rect.height - y) / rect.height) * MAX_RANGE;

        setHoverPos({ r1, r2 });

        // Common Calc
        const { t1, t2, b1, b2, os1 } = contextRef.current;
        const dt = t2 - t1;
        if (dt <= 0) return;

        const rad1 = (b1 * Math.PI) / 180;
        const rad2 = (b2 * Math.PI) / 180;

        const p1x = os1.x + r1 * YARDS_TO_FEET * Math.sin(rad1);
        const p1y = os1.y + r1 * YARDS_TO_FEET * Math.cos(rad1);

        const store = useSubmarineStore.getState();
        const os2 = store.ownShipHistory.find(os => Math.abs(os.time - t2) < 1.0) || store.ownShipHistory[0];

        const p2x = os2.x + r2 * YARDS_TO_FEET * Math.sin(rad2);
        const p2y = os2.y + r2 * YARDS_TO_FEET * Math.cos(rad2);

        const vx = (p2x - p1x) / dt;
        const vy = (p2y - p1y) / dt;

        const speedKts = Math.sqrt(vx*vx + vy*vy) / FEET_PER_KNOT_SEC;
        const course = normalizeAngle(Math.atan2(vx, vy) * 180 / Math.PI);

        if (isDragging && selectedTrackerId) {
             // Update Live
             store.updateTrackerSolution(selectedTrackerId, {
                 range: r1, // R1 is start range
                 bearing: b1, // Fixed B1
                 course: course,
                 speed: speedKts,
                 anchorTime: t1,
                 anchorOwnShip: os1
                 // Note: updateTrackerSolution handles syncing this to legs
             });
        } else {
             // Ghost Mode
            const ghostLeg: SolutionLeg = {
                startTime: t1,
                startRange: r1,
                startBearing: b1,
                course,
                speed: speedKts,
                startOwnShip: os1
            };

            const ghostSolution: TrackerSolution = {
                legs: [ghostLeg],
                speed: speedKts,
                range: r1,
                course,
                bearing: b1,
                anchorTime: t1,
                anchorOwnShip: os1,
                computedWorldX: p1x,
                computedWorldY: p1y
            };

            onGhostSolution(ghostSolution);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const handlePointerLeave = () => {
        if (!isDragging) {
            setHoverPos(null);
            onGhostSolution(null);
        }
    };

    return (
        <div className="relative w-full h-full bg-gray-900 border-r border-gray-700 select-none"
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
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
                {calculating && <div className="text-yellow-400 animate-pulse">CALCULATING...</div>}
            </div>

            {/* Native Canvas */}
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="block w-full h-full"
                style={{ imageRendering: 'pixelated' }}
            />

            {/* Overlay Labels */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-500 pointer-events-none">R1 (START)</div>
            <div className="absolute top-2 right-2 text-xs text-gray-500 transform rotate-90 origin-top-right pointer-events-none">R2 (END)</div>
        </div>
    );
};

export default PEPDisplay;
