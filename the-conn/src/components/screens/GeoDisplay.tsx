import React from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { Contact, Tracker, Torpedo } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { RangeTriageDisplay } from '../panels/RangeTriageDisplay';
import { calculateTargetPosition, FEET_PER_KNOT_SEC, normalizeAngle } from '../../lib/tma';

interface GeometrySnapshot {
    time: number;
    ownShip: { x: number, y: number, heading: number };
    bearing: number; // True Bearing
}

const getProjectedPointOnLine = (
    mouse: { x: number, y: number },
    origin: { x: number, y: number },
    bearingDeg: number
) => {
    const rad = (bearingDeg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);

    // Vector V = Mouse - Origin
    const vx = mouse.x - origin.x;
    const vy = mouse.y - origin.y;

    // t = V . D
    const t = vx * dx + vy * dy;

    // Projection P = Origin + t * D
    return {
        x: origin.x + t * dx,
        y: origin.y + t * dy,
        t: t
    };
};

// Colors
const COLOR_BG = 0x001133;
const COLOR_OWN_SHIP = 0x0088FF; // Blue
const COLOR_TRACKER_AMBER = 0xFFB000;
const COLOR_TRACKER_RED = 0xFF0000; // Weapon Trace
const COLOR_SELECTED = 0xFF8800; // Orange
const COLOR_TORPEDO = 0xFFFF00; // Yellow
const COLOR_RANGE_RING = 0x445566;
const COLOR_BEARING_LINE = 0x00FFFF; // Cyan
const COLOR_SOLUTION_LINE = 0xFFFFFF; // White
const COLOR_HANDLE = 0xFFFFFF;

// Constants
const VIEW_RADIUS_YARDS = 12000;

const GeoDisplay: React.FC = () => {
    const { ref: parentRef, width, height } = useResize();

    // Subscribe to store
    const x = useSubmarineStore(state => state.x);
    const y = useSubmarineStore(state => state.y);
    const heading = useSubmarineStore(state => state.heading);

    const ownShip = React.useMemo(() => ({ x, y, heading }), [x, y, heading]);

    const trackers = useSubmarineStore(state => state.trackers);
    const contacts = useSubmarineStore(state => state.contacts);
    const selectedTrackerId = useSubmarineStore(state => state.selectedTrackerId);
    const torpedoes = useSubmarineStore(state => state.torpedoes);
    const gameTime = useSubmarineStore(state => state.gameTime);
    const updateTrackerSolution = useSubmarineStore(state => state.updateTrackerSolution);

    // Store God Mode
    const isGodMode = useSubmarineStore(state => state.godMode);
    const expertMode = useSubmarineStore(state => state.expertMode);
    const toggleGodMode = useSubmarineStore(state => state.toggleGodMode);

    const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

    // Viewport State
    const [viewport, setViewport] = React.useState({ x: 0, y: 0, zoom: 1.0 });
    const [geometrySnapshot, setGeometrySnapshot] = React.useState<GeometrySnapshot | null>(null);

    // Snapshot Logic
    const updateSnapshot = React.useCallback(() => {
        if (!selectedTracker) return;
        const trueBearing = normalizeAngle(ownShip.heading + selectedTracker.currentBearing);
        setGeometrySnapshot({
            time: gameTime,
            ownShip: { ...ownShip },
            bearing: trueBearing
        });
    }, [ownShip, selectedTracker, gameTime]);

    React.useEffect(() => {
        if (selectedTrackerId) {
            updateSnapshot();
        } else {
            setGeometrySnapshot(null);
        }
    }, [selectedTrackerId]); // Only trigger on selection change

    const isDragging = React.useRef(false);
    const isDraggingHandle = React.useRef<'P1' | 'P2' | null>(null);
    const lastMousePos = React.useRef({ x: 0, y: 0 });

    // Keyboard Handler for Hidden Toggle
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                toggleGodMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleGodMode]);

    // Coordinate Transform
    const baseScale = Math.min(width, height) / (VIEW_RADIUS_YARDS * 2) * 0.9;
    const center = { x: (width / 2) + viewport.x, y: (height / 2) + viewport.y };
    const globalScale = baseScale * viewport.zoom;

    // Pan/Zoom Handlers
    const handleWheel = (e: React.WheelEvent) => {
        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? viewport.zoom * zoomFactor : viewport.zoom / zoomFactor;
        // Clamp Zoom
        const clampedZoom = Math.max(0.1, Math.min(5.0, newZoom));
        setViewport(prev => ({ ...prev, zoom: clampedZoom }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only Pan on Right Click or Middle Click
        // Left Click handled by Graphics components if they stop propagation, but we use 'isDraggingHandle' flag.
        if (e.button === 2 || e.button === 1) {
             isDragging.current = true;
             lastMousePos.current = { x: e.clientX, y: e.clientY };
             e.preventDefault();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDraggingHandle.current && selectedTracker) {
            // -- INTERACTIVE STRIP PLOT LOGIC --
            const tracker = selectedTracker;
            const solution = tracker.solution;

            // Convert Screen -> World
            // ScreenX = CenterX + (WorldX - OwnShipX) * GlobalScale
            // WorldX = ((ScreenX - CenterX) / GlobalScale) + OwnShipX
            // ScreenY = CenterY - (WorldY - OwnShipY) * GlobalScale (Y Flip)
            // WorldY = OwnShipY - ((ScreenY - CenterY) / GlobalScale)

            const mouseWorldX = ownShip.x + ((e.clientX - center.x) / globalScale);
            const mouseWorldY = ownShip.y - ((e.clientY - center.y) / globalScale); // Note the sign flip for Y
            const mouseWorld = { x: mouseWorldX, y: mouseWorldY };

            if (isDraggingHandle.current === 'P1') {
                // Dragging Anchor (P1)
                // Constraint: Bearing Line 1 (from anchorOwnShip along solution.bearing)
                const p1Proj = getProjectedPointOnLine(mouseWorld, solution.anchorOwnShip, solution.bearing);
                let newRange = Math.max(100, p1Proj.t / 3);

                // Scenario A: P1 moves. P2 stays fixed in space (relative to world).
                // Existing P2 World Pos:
                const p2World = calculateTargetPosition(solution, gameTime);

                // New P1 World Pos:
                const rad = (solution.bearing * Math.PI) / 180;
                const newP1X = solution.anchorOwnShip.x + Math.sin(rad) * newRange * 3;
                const newP1Y = solution.anchorOwnShip.y + Math.cos(rad) * newRange * 3;

                // Vector NewP1 -> FixedP2
                const vecX = p2World.x - newP1X;
                const vecY = p2World.y - newP1Y;
                const dist = Math.sqrt(vecX*vecX + vecY*vecY);

                // New Course/Speed
                let newCourse = normalizeAngle(Math.atan2(vecX, vecY) * (180 / Math.PI));
                const dt = gameTime - solution.anchorTime;
                if (dt > 0.1) {
                     const speedFps = dist / dt;
                     const newSpeed = speedFps / FEET_PER_KNOT_SEC;
                     updateTrackerSolution(tracker.id, { range: newRange, course: newCourse, speed: newSpeed });
                }
            }
            else if (isDraggingHandle.current === 'P2') {
                 // Scenario B: Dragging Current Pos (P2)
                 // Constraint: Bearing Line 2. Use Snapshot if available to lock line.
                 // If no snapshot, fallback to live data (which may jitter).
                 let origin = ownShip;
                 let bearing = normalizeAngle(tracker.currentBearing + ownShip.heading);

                 if (geometrySnapshot) {
                     origin = geometrySnapshot.ownShip;
                     bearing = geometrySnapshot.bearing;
                 }

                 const p2Proj = getProjectedPointOnLine(mouseWorld, origin, bearing);

                 if (p2Proj.t > 100) { // Min range check
                      const newP2X = p2Proj.x;
                      const newP2Y = p2Proj.y;

                      // P1 is Fixed (derived from current solution.range)
                      const p1Rad = (solution.bearing * Math.PI) / 180;
                      const p1Dist = solution.range * 3;
                      const p1X = solution.anchorOwnShip.x + Math.sin(p1Rad) * p1Dist;
                      const p1Y = solution.anchorOwnShip.y + Math.cos(p1Rad) * p1Dist;

                      const vectorX = newP2X - p1X;
                      const vectorY = newP2Y - p1Y;
                      const distFt = Math.sqrt(vectorX * vectorX + vectorY * vectorY);

                      // Course = Angle of Vector
                      let newCourse = Math.atan2(vectorX, vectorY) * (180 / Math.PI);
                      newCourse = normalizeAngle(newCourse);

                      // Speed = Dist / Time
                      const dt = gameTime - solution.anchorTime;
                      if (dt > 0.1) {
                          const speedFps = distFt / dt;
                          const newSpeed = speedFps / FEET_PER_KNOT_SEC;
                          updateTrackerSolution(tracker.id, { course: newCourse, speed: newSpeed });
                      }
                 }
            }

        } else if (isDragging.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        isDraggingHandle.current = null;
    };

    const handleCenter = () => {
        setViewport({ x: 0, y: 0, zoom: 1.0 });
    };

    const [showRangeTriage, setShowRangeTriage] = React.useState(false);

    // Disable Context Menu
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    // Callback to start dragging a handle
    const startDragHandle = (handle: 'P1' | 'P2') => {
        isDraggingHandle.current = handle;
    };

    return (
        <div
            ref={parentRef}
            className={`w-full h-full bg-[#001133] relative overflow-hidden select-none ${isGodMode ? 'border-4 border-red-500/50' : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
        >
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: COLOR_BG, antialias: true }}>
                    <Container x={(width / 2) + viewport.x} y={(height / 2) + viewport.y} scale={viewport.zoom}>
                        {/* 1. Grid / Range Rings */}
                        <RangeRings scale={baseScale} />

                        {/* 2. Trackers (Normal Mode) */}
                        {trackers.map(tracker => (
                            <TrackerSymbol
                                key={tracker.id}
                                tracker={tracker}
                                ownShip={ownShip}
                                scale={baseScale}
                                isSelected={tracker.id === selectedTrackerId}
                                gameTime={gameTime}
                            />
                        ))}

                        {/* 2b. God Mode (Truth) */}
                        {isGodMode && contacts.filter(c => c.status !== 'DESTROYED').map(contact => (
                            <GodModeSymbol
                                key={contact.id}
                                contact={contact}
                                ownShip={ownShip}
                                scale={baseScale}
                            />
                        ))}

                        {/* 3. Torpedoes */}
                        {torpedoes.filter(torpedo => {
                            if (isGodMode) return true;
                            if (torpedo.designatedTargetId === 'OWNSHIP' && torpedo.isHostile === false) return true;
                            if (!torpedo.isHostile) return true;
                            const trackerId = `W-${torpedo.id}`;
                            const isDetected = trackers.some(t => t.id === trackerId);
                            return isDetected;
                        }).map(torpedo => (
                            <TorpedoSymbol
                                key={torpedo.id}
                                torpedo={torpedo}
                                ownShip={ownShip}
                                scale={baseScale}
                            />
                        ))}

                        {/* 4. Ownship (Last so it's on top) */}
                        <OwnShipSymbol heading={ownShip.heading} />

                        {/* 5. Strip Plot Overlay (Interactive) */}
                        {selectedTracker && selectedTracker.solution.range > 0 && (
                            <StripPlotOverlay
                                tracker={selectedTracker}
                                ownShip={ownShip}
                                scale={baseScale}
                                gameTime={gameTime}
                                onDragStart={startDragHandle}
                                viewportZoom={viewport.zoom}
                                geometrySnapshot={geometrySnapshot}
                            />
                        )}

                    </Container>
                </Stage>
            )}

            {/* UI Overlays */}
            <div className="absolute top-2 left-2 text-cyan-500 font-mono text-xs opacity-70 pointer-events-none">
                <div>MODE: NORTH-UP</div>
                <div>SCALE: 10k YDS</div>
            </div>

            {/* Range Triage Toggle */}
            <div className="absolute top-10 right-2 pointer-events-auto">
                <button
                    onClick={() => setShowRangeTriage(!showRangeTriage)}
                    className={`px-2 py-1 text-xs font-bold font-mono border rounded ${
                        showRangeTriage
                            ? 'bg-cyan-900/80 text-cyan-200 border-cyan-500'
                            : 'bg-black/50 text-cyan-600 border-zinc-800 hover:text-cyan-400'
                    }`}
                >
                    {showRangeTriage ? 'HIDE TRIAGE' : 'SHOW TRIAGE'}
                </button>
            </div>

            {/* Sync Button */}
             <div className="absolute bottom-2 right-24 pointer-events-auto">
                <button
                    onClick={updateSnapshot}
                    className="px-2 py-1 text-xs font-bold font-mono border rounded bg-black/50 text-cyan-600 border-zinc-800 hover:text-cyan-400"
                >
                    SYNC T2
                </button>
            </div>

            {/* Center Button */}
             <div className="absolute bottom-2 right-2 pointer-events-auto">
                <button
                    onClick={handleCenter}
                    className="px-2 py-1 text-xs font-bold font-mono border rounded bg-black/50 text-cyan-600 border-zinc-800 hover:text-cyan-400"
                >
                    CENTER
                </button>
            </div>


            {/* Range Triage Display */}
            {showRangeTriage && (
                <div className="absolute top-20 right-2 pointer-events-auto z-20">
                    <RangeTriageDisplay width={200} height={200} />
                </div>
            )}

            {/* GOD MODE WARNING */}
            {isGodMode && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-red-500 font-bold animate-pulse pointer-events-none">
                    SIMULATION UNSAFE - GOD MODE ACTIVE
                </div>
            )}

            {/* GOD MODE TOGGLE - Hidden in Expert Mode */}
            {!expertMode && (
                <div className="absolute top-2 right-2 pointer-events-auto">
                    <button
                        onClick={() => toggleGodMode()}
                        className={`px-2 py-1 text-xs font-bold font-mono border rounded ${
                            isGodMode
                            ? 'bg-purple-900/80 text-purple-200 border-purple-500 animate-pulse'
                            : 'bg-black/50 text-zinc-600 border-zinc-800 hover:text-zinc-400'
                        }`}
                    >
                        GOD
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Subcomponents ---

const StripPlotOverlay: React.FC<{
    tracker: Tracker,
    ownShip: { x: number, y: number, heading: number },
    scale: number,
    gameTime: number,
    onDragStart: (handle: 'P1' | 'P2') => void,
    viewportZoom: number,
    geometrySnapshot: GeometrySnapshot | null
}> = ({ tracker, ownShip, scale, gameTime, onDragStart, viewportZoom, geometrySnapshot }) => {
    const { solution } = tracker;

    // 1. Calculate P1 (Anchor Position)
    // Use computedWorldX/Y (Position at Anchor Time)
    let p1X = solution.computedWorldX;
    let p1Y = solution.computedWorldY;

    // Fallback if computed is missing
    if (p1X === undefined || p1Y === undefined) {
         const radAnchorBearing = (solution.bearing * Math.PI) / 180;
         p1X = solution.anchorOwnShip.x + Math.sin(radAnchorBearing) * solution.range * 3;
         p1Y = solution.anchorOwnShip.y + Math.cos(radAnchorBearing) * solution.range * 3;
    }

    // 2. Calculate P2 (Current Position)
    // Use helper from tma.ts
    const p2Pos = calculateTargetPosition(solution, gameTime);
    const p2X = p2Pos.x;
    const p2Y = p2Pos.y;

    // 3. Screen Coords (Relative)
    const relP1X = (p1X - ownShip.x) * scale;
    const relP1Y = -(p1Y - ownShip.y) * scale;

    const relP2X = (p2X - ownShip.x) * scale;
    const relP2Y = -(p2Y - ownShip.y) * scale;

    // 4. Bearing Lines
    // Line 1: From Anchor Ownship along solution.bearing (or anchorBearing if stored separately?)
    // Note: solution.bearing IS the anchor bearing.
    // Anchor Ownship might differ from Current Ownship if we moved.
    // Screen Coord for Anchor Ownship:
    const relAnchorOwnX = (solution.anchorOwnShip.x - ownShip.x) * scale;
    const relAnchorOwnY = -(solution.anchorOwnShip.y - ownShip.y) * scale;

    // Line 2: From Current Ownship along tracker.currentBearing (or Snapshot)
    let origin2 = ownShip;
    let bearing2 = normalizeAngle(tracker.currentBearing + ownShip.heading);

    if (geometrySnapshot) {
        origin2 = geometrySnapshot.ownShip;
        bearing2 = geometrySnapshot.bearing;
    }

    const relOrigin2X = (origin2.x - ownShip.x) * scale;
    const relOrigin2Y = -(origin2.y - ownShip.y) * scale;

    // Render Function
    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        // -- Bearing Line 1 (Start) --
        const bearing1Rad = (solution.bearing * Math.PI) / 180;
        const vec1X = Math.sin(bearing1Rad) * 20000 * scale; // Long line
        const vec1Y = -Math.cos(bearing1Rad) * 20000 * scale; // -Y is North

        g.lineStyle(1, COLOR_BEARING_LINE, 0.3);
        // From Anchor Ownship
        g.moveTo(relAnchorOwnX, relAnchorOwnY);
        g.lineTo(relAnchorOwnX + vec1X, relAnchorOwnY + vec1Y);

        // -- Bearing Line 2 (Current or Snapshot) --
        const bearing2Rad = (bearing2 * Math.PI) / 180;
        const vec2X = Math.sin(bearing2Rad) * 20000 * scale;
        const vec2Y = -Math.cos(bearing2Rad) * 20000 * scale;

        g.lineStyle(1, COLOR_BEARING_LINE, 0.3);
        // From Line 2 Origin
        g.moveTo(relOrigin2X, relOrigin2Y);
        g.lineTo(relOrigin2X + vec2X, relOrigin2Y + vec2Y);

        // -- Solution Vector (P1 -> P2) --
        g.lineStyle(2, COLOR_SOLUTION_LINE, 0.8);
        g.moveTo(relP1X, relP1Y);
        g.lineTo(relP2X, relP2Y);

    }, [relP1X, relP1Y, relP2X, relP2Y, relAnchorOwnX, relAnchorOwnY, relOrigin2X, relOrigin2Y, solution.bearing, bearing2, scale]);

    // Handle Radius logic
    // We want a constant visual size handle regardless of zoom
    const handleRadius = 6 / viewportZoom;

    const drawHandleP1 = React.useCallback((g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(1, COLOR_HANDLE, 1);
        g.beginFill(0x000000);
        g.drawCircle(0, 0, handleRadius);
        g.endFill();
    }, [handleRadius]);

    const drawHandleP2 = React.useCallback((g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(1, COLOR_HANDLE, 1);
        g.beginFill(0x000000);
        g.drawCircle(0, 0, handleRadius);
        g.endFill();
    }, [handleRadius]);

    return (
        <Container>
            <Graphics draw={draw} />

            {/* P1 Handle */}
            <Container
                x={relP1X} y={relP1Y}
                eventMode="static"
                cursor="pointer"
                onpointerdown={(e) => {
                    e.stopPropagation();
                    onDragStart('P1');
                }}
            >
                <Graphics draw={drawHandleP1} />
            </Container>

             {/* P2 Handle */}
             <Container
                x={relP2X} y={relP2Y}
                eventMode="static"
                cursor="pointer"
                onpointerdown={(e) => {
                    e.stopPropagation();
                    onDragStart('P2');
                }}
            >
                <Graphics draw={drawHandleP2} />
            </Container>

        </Container>
    );
};

const RangeRings: React.FC<{ scale: number }> = ({ scale }) => {
    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(1, COLOR_RANGE_RING, 0.5);

        // 2k, 5k, 10k
        [2000, 5000, 10000].forEach(range => {
            g.drawCircle(0, 0, range * scale);
        });

        // Crosshairs
        g.lineStyle(1, COLOR_RANGE_RING, 0.3);
        const maxR = 12000 * scale;
        g.moveTo(-maxR, 0); g.lineTo(maxR, 0);
        g.moveTo(0, -maxR); g.lineTo(0, maxR);

    }, [scale]);

    return <Graphics draw={draw} />;
};

const OwnShipSymbol: React.FC<{ heading: number }> = ({ heading }) => {
    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        // Ship shape
        g.lineStyle(2, COLOR_OWN_SHIP, 1);
        g.beginFill(0x000000);
        g.drawPolygon([
            0, -15,  // Nose
            10, 15,  // Rear Right
            0, 10,   // Notch
            -10, 15, // Rear Left
        ]);
        g.endFill();

    }, []);

    return <Graphics draw={draw} rotation={heading * Math.PI / 180} />;
};

const TrackerSymbol: React.FC<{
    tracker: Tracker,
    ownShip: { x: number, y: number },
    scale: number,
    isSelected: boolean,
    gameTime: number
}> = ({ tracker, ownShip, scale, isSelected, gameTime }) => {
    const { solution } = tracker;

    // --- Dead Reckoning Projection ---
    let fixX = solution.computedWorldX;
    let fixY = solution.computedWorldY;

    if (fixX === undefined || fixY === undefined) {
         const radAnchorBearing = (solution.bearing * Math.PI) / 180;
         fixX = solution.anchorOwnShip.x + Math.sin(radAnchorBearing) * solution.range * 3;
         fixY = solution.anchorOwnShip.y + Math.cos(radAnchorBearing) * solution.range * 3;
    }

    // 2. Project Forward (The DR Track)
    const timeDelta = gameTime - solution.anchorTime;
    const speedFps = solution.speed * FEET_PER_KNOT_SEC;
    const distTraveledFt = speedFps * timeDelta;

    const radCourse = (solution.course * Math.PI) / 180;
    const currentTargetX = fixX + Math.sin(radCourse) * distTraveledFt;
    const currentTargetY = fixY + Math.cos(radCourse) * distTraveledFt;

    // 3. Screen Coordinates (Relative to Ownship)
    const relX = (currentTargetX - ownShip.x) * scale;
    const relY = -(currentTargetY - ownShip.y) * scale;

    // Fix Position (for visualization)
    const fixRelX = (fixX - ownShip.x) * scale;
    const fixRelY = -(fixY - ownShip.y) * scale;

    const isSolutionIncomplete = !solution.range || solution.range < 100;

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        const isWeapon = tracker.kind === 'WEAPON';
        const isHostile = tracker.classification === 'SUB' || tracker.classification === 'ESCORT';
        const color = isSelected
            ? COLOR_SELECTED
            : (isWeapon || isHostile)
                ? COLOR_TRACKER_RED
                : COLOR_TRACKER_AMBER;

        const alpha = isSelected ? 1.0 : 0.8;
        const lineWeight = isSelected ? 3 : 2;

        if (isSolutionIncomplete) {
            // Infinite Bearing Line
            const bearing = tracker.currentBearing;
            const rad = (bearing * Math.PI) / 180;
            const vecX = Math.sin(rad) * 1000;
            const vecY = -Math.cos(rad) * 1000;

            g.lineStyle(2, color, 0.4);
            g.moveTo(0, 0);
            g.lineTo(vecX, vecY);

            g.beginFill(color, 0.4);
            g.drawCircle(vecX * 0.1, vecY * 0.1, 4);
            g.endFill();

        } else {
            // --- DRAW DR VISUALIZATION (Fix + Track) ---
            // Fix Marker
            g.lineStyle(1, color, 0.5);
            g.moveTo(fixRelX - 3, fixRelY - 3); g.lineTo(fixRelX + 3, fixRelY + 3);
            g.moveTo(fixRelX + 3, fixRelY - 3); g.lineTo(fixRelX - 3, fixRelY + 3);

            // DR Track
            g.lineStyle(1, color, 0.3);
            g.moveTo(fixRelX, fixRelY);
            g.lineTo(relX, relY);

            // --- DRAW SYMBOL ---
            g.lineStyle(lineWeight, color, alpha);
            const size = 6;

            if (isWeapon) {
                // Triangle
                g.moveTo(relX, relY - size);
                g.lineTo(relX + size, relY + size);
                g.lineTo(relX - size, relY + size);
                g.lineTo(relX, relY - size);
            } else {
                // Square for Contact
                g.drawRect(relX - size, relY - size, size * 2, size * 2);
            }

            // Velocity Vector
            const vecLen = 40;
            const courseRad = (solution.course * Math.PI) / 180;
            const tipX = relX + Math.sin(courseRad) * vecLen;
            const tipY = relY - Math.cos(courseRad) * vecLen;

            g.moveTo(relX, relY);
            g.lineTo(tipX, tipY);
        }

    }, [relX, relY, isSolutionIncomplete, tracker.currentBearing, solution.course, isSelected, scale, fixRelX, fixRelY]);

    return (
        <React.Fragment>
            <Graphics draw={draw} />
            {!isSolutionIncomplete && (
                <Text
                    text={tracker.id}
                    x={relX + 10}
                    y={relY - 10}
                    style={new PIXI.TextStyle({
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fill: isSelected
                             ? COLOR_SELECTED
                             : (tracker.kind === 'WEAPON' || tracker.classification === 'SUB' || tracker.classification === 'ESCORT')
                                 ? COLOR_TRACKER_RED
                                 : COLOR_TRACKER_AMBER
                    })}
                />
            )}
        </React.Fragment>
    );
};

const TorpedoSymbol: React.FC<{
    torpedo: Torpedo,
    ownShip: { x: number, y: number },
    scale: number
}> = ({ torpedo, ownShip, scale }) => {
    const relX = (torpedo.position.x - ownShip.x) * scale;
    const relY = -(torpedo.position.y - ownShip.y) * scale;

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        if (torpedo.status === 'RUNNING') {
            g.lineStyle(1, COLOR_TORPEDO, 1);
            g.beginFill(COLOR_TORPEDO);
            g.drawCircle(0, 0, 3);
            g.endFill();

            const rad = (torpedo.heading * Math.PI) / 180;
            const tailLen = 10;
            const tailX = -Math.sin(rad) * tailLen;
            const tailY = Math.cos(rad) * tailLen;
            g.moveTo(0,0);
            g.lineTo(tailX, tailY);
        }
    }, [torpedo.heading, torpedo.status]);

    return (
        <Container x={relX} y={relY}>
            <Graphics draw={draw} />
        </Container>
    );
};

const GodModeSymbol: React.FC<{
    contact: Contact,
    ownShip: { x: number, y: number },
    scale: number
}> = ({ contact, ownShip, scale }) => {
    const isEnemy = contact.classification === 'SUB' || contact.classification === 'ESCORT';
    const color = isEnemy ? 0xFF0000 : 0x00FF00;

    const relX = (contact.x - ownShip.x) * scale;
    const relY = -(contact.y - ownShip.y) * scale;

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(2, color, 1);

        if (isEnemy) {
            g.drawRect(-6, -6, 12, 12);
        } else if (contact.classification === 'TRAWLER') {
            g.drawPolygon([
                0, -8,
                6, 0,
                0, 8,
                -6, 0
            ]);
        } else {
            g.drawCircle(0, 0, 6);
        }

        if (contact.heading !== undefined) {
            const len = 20;
            const rad = (contact.heading * Math.PI) / 180;
            const vecX = Math.sin(rad) * len;
            const vecY = -Math.cos(rad) * len;
            g.moveTo(0, 0);
            g.lineTo(vecX, vecY);
        }

    }, [color, isEnemy, contact.heading]);

    return (
        <Container x={relX} y={relY}>
            <Graphics draw={draw} />
            <Text
                text={contact.classification?.substring(0, 3) || 'UNK'}
                x={10}
                y={-10}
                style={new PIXI.TextStyle({
                    fontFamily: 'monospace',
                    fontSize: 10,
                    fill: color
                })}
            />
        </Container>
    );
};

export default GeoDisplay;
