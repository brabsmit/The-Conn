import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { generateSafetyHeatmap } from '../../utils/AnalysisUtils';
import type { SafetyLevel } from '../../utils/AnalysisUtils';

const COLOR_SAFE = 'rgba(0, 255, 0, 0.1)';
const COLOR_WARNING = 'rgba(255, 200, 0, 0.4)';
const COLOR_DANGER = 'rgba(255, 0, 0, 0.5)';
const COLOR_GRID = '#445566';
const COLOR_TEXT = '#00aaaa';
const COLOR_OWNSHIP = '#ffffff';

interface RangeTriageDisplayProps {
    width?: number;
    height?: number;
}

export const RangeTriageDisplay: React.FC<RangeTriageDisplayProps> = ({ width = 300, height = 300 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Store Access
    const x = useSubmarineStore(state => state.x);
    const y = useSubmarineStore(state => state.y);
    const heading = useSubmarineStore(state => state.heading);
    const ownShip = useMemo(() => ({ x, y, heading }), [x, y, heading]);

    const trackers = useSubmarineStore(state => state.trackers);
    const orderedHeading = useSubmarineStore(state => state.orderedHeading);
    const orderedSpeed = useSubmarineStore(state => state.orderedSpeed);
    const setOrderedHeading = useSubmarineStore(state => state.setOrderedHeading);
    const setOrderedSpeed = useSubmarineStore(state => state.setOrderedSpeed);
    const tickCount = useSubmarineStore(state => state.tickCount); // Force re-render on tick

    // Local State for Trial Vector
    const [isDragging, setIsDragging] = useState(false);
    const [trialHeading, setTrialHeading] = useState<number | null>(null);
    const [trialSpeed, setTrialSpeed] = useState<number | null>(null);

    // Derived State
    const currentHeading = trialHeading ?? orderedHeading;
    const currentSpeed = trialSpeed ?? orderedSpeed;

    // Memoized Heatmap (re-calc every 60 ticks ~ 1 sec or when trackers change)
    // Actually, trackers change every tick. Let's throttle or just memo on tickCount/60?
    // Doing it every tick might be heavy (72 * 6 = 432 CPA calcs).
    // JS is fast, 432 simple loops is nothing.
    const heatmap = useMemo(() => {
        return generateSafetyHeatmap(ownShip, trackers, 15);
    }, [trackers, tickCount]); // Reduced frequency? trackers update every tick.

    // Helper: Screen Center & Scale
    const cx = width / 2;
    const cy = height / 2;
    const maxSpeed = 30;
    const scale = (Math.min(width, height) / 2) * 0.9 / maxSpeed; // pixels per knot

    // Check Safety of Current Trial
    const checkSafety = (heading: number, speed: number): SafetyLevel => {
        // Find nearest grid point
        const hStep = 10;
        const sStep = 5;
        // Round to nearest grid for lookup (or interpolate?)
        // The heatmap is discrete. Let's lookup the sector we are IN.
        // Or nearest neighbor.
        const hIdx = Math.round(heading / hStep) * hStep % 360;
        const sIdx = Math.round(speed / sStep) * sStep;

        // Clamp speed to grid range for lookup
        const validS = Math.max(0, Math.min(25, sIdx));

        if (heatmap[hIdx] && heatmap[hIdx][validS]) {
            return heatmap[hIdx][validS];
        }
        return 'SAFE';
    };

    const currentSafety = checkSafety(currentHeading, currentSpeed);

    // Canvas Rendering
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Heatmap Sectors
        // We iterate 0-360 by 10 deg steps, and 0-25 speed by 5 steps.
        const angleStep = 10;
        const speedStep = 5;

        for (let angle = 0; angle < 360; angle += angleStep) {
            for (let speed = 0; speed <= 25; speed += speedStep) {
                const safety = heatmap[angle]?.[speed];
                if (!safety || safety === 'SAFE') continue;

                const color = safety === 'DANGER' ? COLOR_DANGER : COLOR_WARNING;

                // Draw Sector
                // Inner Radius (speed - 2.5) * scale
                // Outer Radius (speed + 2.5) * scale
                const rInner = Math.max(0, (speed - 2.5)) * scale;
                const rOuter = (speed + 2.5) * scale;

                // Angles (Pixi 0 is East, Canvas 0 is East. Navigation 0 is North).
                // Nav Angle A -> Canvas Angle (A - 90) * PI/180
                const aStart = (angle - angleStep / 2 - 90) * (Math.PI / 180);
                const aEnd = (angle + angleStep / 2 - 90) * (Math.PI / 180);

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(cx, cy, rOuter, aStart, aEnd);
                ctx.arc(cx, cy, rInner, aEnd, aStart, true); // Go back
                ctx.closePath();
                ctx.fill();
            }
        }

        // 2. Draw Grid (Speed Rings & Spokes)
        ctx.strokeStyle = COLOR_GRID;
        ctx.lineWidth = 1;

        // Rings
        [5, 10, 15, 20, 25].forEach(s => {
            ctx.beginPath();
            ctx.arc(cx, cy, s * scale, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Spokes (every 30 deg)
        for (let a = 0; a < 360; a += 30) {
            const rad = (a - 90) * (Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(rad) * maxSpeed * scale, cy + Math.sin(rad) * maxSpeed * scale);
            ctx.stroke();
        }

        // 3. Draw Ownship Vector (Trial)
        const radHeading = (currentHeading - 90) * (Math.PI / 180);
        const vecLen = currentSpeed * scale;
        const tipX = cx + Math.cos(radHeading) * vecLen;
        const tipY = cy + Math.sin(radHeading) * vecLen;

        // Color based on safety
        const arrowColor = currentSafety === 'DANGER' ? '#FF0000' : currentSafety === 'WARNING' ? '#FFFF00' : '#FFFFFF';

        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = arrowColor;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Ghost Actual (if dragging)
        if (isDragging) {
             const radActual = (orderedHeading - 90) * (Math.PI / 180);
             const lenActual = orderedSpeed * scale;
             ctx.strokeStyle = 'rgba(255,255,255,0.3)';
             ctx.beginPath();
             ctx.moveTo(cx, cy);
             ctx.lineTo(cx + Math.cos(radActual) * lenActual, cy + Math.sin(radActual) * lenActual);
             ctx.stroke();
        }

    }, [width, height, heatmap, currentHeading, currentSpeed, isDragging, scale, orderedHeading, orderedSpeed, currentSafety]);

    // Input Handling
    const handlePointerDown = (e: React.PointerEvent) => {
        // Simple hit test: anywhere in canvas starts drag?
        // Or only near tip? Let's say anywhere for ease of use, updates "Trial".
        setIsDragging(true);
        updateFromPointer(e);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            updateFromPointer(e);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const updateFromPointer = (e: React.PointerEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left - cx;
        const y = e.clientY - rect.top - cy;

        // Angle (Nav)
        // Canvas Angle = atan2(y, x).
        // Nav Angle = Canvas + 90.
        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
        angle = Math.round(angle);

        // Speed
        const dist = Math.sqrt(x*x + y*y);
        let speed = dist / scale;
        speed = Math.min(30, Math.max(0, speed));
        speed = Math.round(speed * 10) / 10; // 1 decimal

        setTrialHeading(angle);
        setTrialSpeed(speed);
    };

    const commitManeuver = () => {
        if (trialHeading !== null) setOrderedHeading(trialHeading);
        if (trialSpeed !== null) setOrderedSpeed(trialSpeed);
        setTrialHeading(null);
        setTrialSpeed(null);
    };

    return (
        <div className="flex flex-col items-center bg-black/80 border border-slate-700 p-2 rounded shadow-lg backdrop-blur-md select-none">
            <h3 className="text-xs font-bold text-cyan-500 mb-1 w-full text-center">VELOCITY TRIAGE</h3>

            <div
                ref={containerRef}
                className="relative cursor-crosshair touch-none"
                style={{ width, height }}
            >
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                />
            </div>

            {/* Info Panel */}
            <div className="w-full mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
                <div className={`p-1 border rounded ${currentSafety === 'DANGER' ? 'bg-red-900/50 border-red-500 text-red-200' : currentSafety === 'WARNING' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-200' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                    <div className="opacity-70">TRIAL VECTOR</div>
                    <div className="font-bold text-sm">C-{Math.round(currentHeading).toString().padStart(3,'0')} S-{Math.round(currentSpeed)}</div>
                </div>
                <button
                    onClick={commitManeuver}
                    disabled={!isDragging && trialHeading === null}
                    className="p-1 border border-cyan-600 bg-cyan-900/40 text-cyan-300 hover:bg-cyan-800 disabled:opacity-30 disabled:cursor-not-allowed rounded font-bold transition-colors"
                >
                    ORDER<br/>MANEUVER
                </button>
            </div>
            {currentSafety === 'DANGER' && <div className="w-full text-center text-red-500 font-bold text-xs animate-pulse mt-1">⚠️ DANGEROUS CPA ⚠️</div>}
        </div>
    );
};
