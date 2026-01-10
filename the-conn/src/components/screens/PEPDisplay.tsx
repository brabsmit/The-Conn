import React, { useEffect, useRef, useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { normalizeAngle, FEET_PER_KNOT_SEC, YARDS_TO_FEET } from '../../lib/tma';
import type { TrackerSolution, SolutionLeg } from '../../store/types';
import { useResize } from '../../hooks/useResize';

interface PEPDisplayProps {
    onGhostSolution: (solution: TrackerSolution | null) => void;
    onClose: () => void;
}

const GRID_SIZE = 80; // 80x80 grid for solver resolution

const PEPDisplay = ({ onGhostSolution, onClose }: PEPDisplayProps) => {
    const { selectedTrackerId, trackers, ownShipHistory, gameTime } = useSubmarineStore();
    const workerRef = useRef<Worker | null>(null);
    const [calculating, setCalculating] = useState(false);
    const [rangeScale, setRangeScale] = useState(40000); // Default 40k

    // Canvas Refs
    const { ref: resizeRef, width: rawWidth, height: rawHeight } = useResize();
    const width = Math.floor(rawWidth);
    const height = Math.floor(rawHeight);

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
            ctx.save();
            ctx.scale(1, -1);
            ctx.translate(0, -canvas.height);
            ctx.drawImage(lastRenderedFrame.current, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        // Draw Solution Box (Current Tracker State)
        if (selectedTrackerId && contextRef.current) {
             const tracker = trackers.find(t => t.id === selectedTrackerId);
             if (tracker && tracker.solution.legs.length) {
                 const leg = tracker.solution.legs[tracker.solution.legs.length - 1];
                 const t2 = gameTime;

                 const r1 = leg.startRange;

                 // Project current R2
                 const dt = t2 - leg.startTime;
                 const spdFt = leg.speed * FEET_PER_KNOT_SEC;
                 const crsRad = leg.course * Math.PI / 180;

                 const brgRad = leg.startBearing * Math.PI / 180;
                 const rngFt = leg.startRange * YARDS_TO_FEET;
                 const ax = leg.startOwnShip.x + rngFt * Math.sin(brgRad);
                 const ay = leg.startOwnShip.y + rngFt * Math.cos(brgRad);

                 const tx = ax + Math.sin(crsRad) * spdFt * dt;
                 const ty = ay + Math.cos(crsRad) * spdFt * dt;

                 const store = useSubmarineStore.getState();
                 const actualOS2 = store.ownShipHistory.find(os => Math.abs(os.time - t2) < 1.0) || store.ownShipHistory[store.ownShipHistory.length - 1] || leg.startOwnShip;

                 const dx = tx - actualOS2.x;
                 const dy = ty - actualOS2.y;
                 const r2 = Math.sqrt(dx*dx + dy*dy) / YARDS_TO_FEET;

                 const sx = (r1 / rangeScale) * width;
                 const sy = height - (r2 / rangeScale) * height; // Flip Y for display

                 // Only draw if within bounds
                 if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
                     ctx.strokeStyle = 'white'; // White box per instructions
                     ctx.fillStyle = 'rgba(0,0,0,0.5)';
                     ctx.lineWidth = 2;
                     ctx.beginPath();
                     ctx.rect(sx - 6, sy - 6, 12, 12);
                     ctx.fill();
                     ctx.stroke();
                 }
             }
        }
    };

    // Re-draw on resize or when calculating state changes
    useEffect(() => {
        draw();
    }, [width, height, trackers, selectedTrackerId, gameTime, rangeScale]);

    useEffect(() => {
        // Init Worker
        const worker = new Worker(new URL('../../workers/TMASolver.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = async (e) => {
            const { grid, speedGrid } = e.data;

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
                        data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 0;
                    } else {
                        let r=0, g=0, b=0;
                        if (val < 1.0) {
                             const t = val;
                             if (t < 0.5) {
                                 b = 255; g = Math.floor(255 * (t * 2));
                             } else {
                                 g = 255; b = Math.floor(255 * (2 - (t * 2)));
                             }
                        } else if (val < 5.0) {
                            const t = (val - 1.0) / 4.0;
                            r = Math.floor(255 * t); g = Math.floor(255 * (1 - t)); b = 0;
                        } else {
                            r = 255; g = 0; b = 0;
                        }
                        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
                    }
                }

                tempCtx.putImageData(imgData, 0, 0);

                // Speed Contours
                if (speedGrid) {
                    tempCtx.lineWidth = 0.5;
                    tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    // tempCtx.setLineDash([1, 1]); // Dashed lines look messy on small grid when scaled up

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
                                    const t = (threshold - val1) / (val2 - val1);
                                    const cx = x + t;
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
                    });
                }

                try {
                    const bmp = await createImageBitmap(tempCanvas);
                    if (lastRenderedFrame.current) lastRenderedFrame.current.close();
                    lastRenderedFrame.current = bmp;
                    setCalculating(false);
                    draw();
                } catch (err) {
                    console.error("Bitmap creation failed", err);
                    setCalculating(false);
                }
            }
        };

        workerRef.current = worker;
        return () => worker.terminate();
    }, []); // Worker init only once

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

        const getTrueBearing = (t: number) => {
             let nearest = tracker.bearingHistory[0];
             let minDiff = 99999;
             for (const item of tracker.bearingHistory) {
                 const d = Math.abs(item.time - t);
                 if (d < minDiff) { minDiff = d; nearest = item; }
             }
             if (!nearest) return 0;
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

        const step = rangeScale / GRID_SIZE;

        workerRef.current.postMessage({
            t1, t2, b1, b2,
            bearingHistory: tracker.bearingHistory, // Data Isolation: Only selected tracker
            ownShipHistory: ownShipHistory,
            config: {
                r1Start: 0, r1End: rangeScale, r1Step: step,
                r2Start: 0, r2End: rangeScale, r2Step: step
            }
        });

    }, [selectedTrackerId, trackers, gameTime, ownShipHistory, rangeScale]);

    // Handle Input
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
         if (!selectedTrackerId) return;
         const tracker = trackers.find(t => t.id === selectedTrackerId);
         if (!tracker) return;

         // Hit test for white box
         const canvas = canvasRef.current;
         if (!canvas) return;

         const rect = e.currentTarget.getBoundingClientRect();
         const x = e.clientX - rect.left;
         const y = e.clientY - rect.top;

         // Calculate box position
         const leg = tracker.solution.legs[tracker.solution.legs.length - 1];
         const r1 = leg.startRange;

         // Reuse project logic (simplified for hit test, assuming recent draw was correct)
         // But need to be accurate.
         // ...
         // Let's rely on hoverPos? No, hoverPos is where mouse IS.
         // We need where box IS.
         // Let's recalculate simply
         const t2 = gameTime;
         const dt = t2 - leg.startTime;
         const spdFt = leg.speed * FEET_PER_KNOT_SEC;
         const crsRad = leg.course * Math.PI / 180;
         const brgRad = leg.startBearing * Math.PI / 180;
         const rngFt = leg.startRange * YARDS_TO_FEET;
         const ax = leg.startOwnShip.x + rngFt * Math.sin(brgRad);
         const ay = leg.startOwnShip.y + rngFt * Math.cos(brgRad);
         const tx = ax + Math.sin(crsRad) * spdFt * dt;
         const ty = ay + Math.cos(crsRad) * spdFt * dt;
         const store = useSubmarineStore.getState();
         const actualOS2 = store.ownShipHistory.find(os => Math.abs(os.time - t2) < 1.0) || store.ownShipHistory[store.ownShipHistory.length - 1] || leg.startOwnShip;
         const dx = tx - actualOS2.x;
         const dy = ty - actualOS2.y;
         const r2 = Math.sqrt(dx*dx + dy*dy) / YARDS_TO_FEET;

         const boxX = (r1 / rangeScale) * width;
         const boxY = height - (r2 / rangeScale) * height;

         const dist = Math.sqrt((x - boxX)**2 + (y - boxY)**2);

         if (dist < 20) {
             setIsDragging(true);
             e.currentTarget.setPointerCapture(e.pointerId);
         }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!contextRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Clamp to scale
        const r1Raw = (x / rect.width) * rangeScale;
        const r2Raw = ((rect.height - y) / rect.height) * rangeScale;

        const r1 = Math.max(0, Math.min(rangeScale, r1Raw));
        const r2 = Math.max(0, Math.min(rangeScale, r2Raw));

        setHoverPos({ r1, r2 });

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
             store.updateTrackerSolution(selectedTrackerId, {
                 range: r1,
                 bearing: b1,
                 course: course,
                 speed: speedKts,
                 anchorTime: t1,
                 anchorOwnShip: os1
             });
        } else {
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

    // Overlay Styles
    const overlayStyle = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vh] h-[60vh] z-20 bg-green-950/95 border-2 border-gray-700 shadow-2xl shadow-black";

    return (
        <div className={overlayStyle} ref={resizeRef}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start pointer-events-none">
                <div className="text-xs font-mono text-green-500 bg-black/50 p-1">
                    <div>R1-R2 SOLVER</div>
                    {hoverPos && (
                        <>
                        <div>R1: {Math.round(hoverPos.r1)} yds</div>
                        <div>R2: {Math.round(hoverPos.r2)} yds</div>
                        </>
                    )}
                    {calculating && <div className="text-yellow-400 animate-pulse">CALCULATING...</div>}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="pointer-events-auto bg-red-900/50 hover:bg-red-700 text-white text-xs px-2 py-1 border border-red-500"
                >
                    X
                </button>
            </div>

            {/* Range Scale Controls */}
            <div className="absolute top-10 right-2 flex flex-col gap-1 pointer-events-auto z-30">
                {[10, 20, 40, 80].map(k => (
                    <button
                        key={k}
                        onClick={() => setRangeScale(k * 1000)}
                        className={`text-xs px-1 py-0.5 border ${rangeScale === k * 1000 ? 'bg-green-500 text-black border-green-400' : 'bg-black/50 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                    >
                        {k}k
                    </button>
                ))}
            </div>

            <div
                 className="relative w-full h-full cursor-crosshair"
                 onPointerDown={handlePointerDown}
                 onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp}
                 onPointerLeave={handlePointerLeave}
            >
                {/* Native Canvas */}
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="block w-full h-full"
                    style={{ imageRendering: 'pixelated' }}
                />

                {/* Axis Labels */}
                <div className="absolute bottom-1 left-2 text-xs text-gray-500 pointer-events-none">Start Range (0-{rangeScale/1000}k)</div>
                <div className="absolute top-10 right-1 text-xs text-gray-500 transform rotate-90 origin-top-right pointer-events-none">End Range (0-{rangeScale/1000}k)</div>
            </div>
        </div>
    );
};

export default PEPDisplay;
