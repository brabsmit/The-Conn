import React from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { Contact, Tracker, Torpedo } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';

// Colors
const COLOR_BG = 0x001133;
const COLOR_OWN_SHIP = 0xFFFFFF;
const COLOR_TRACKER_AMBER = 0xFFB000;
const COLOR_SELECTED = 0xFF8800; // Orange
const COLOR_TORPEDO = 0xFFFF00; // Yellow
const COLOR_RANGE_RING = 0x445566;

// Zone Colors
const COLOR_ZONE_RED = 0xFF0000;
const COLOR_ZONE_YELLOW = 0xFFFF00;
const COLOR_ZONE_GREEN = 0x00FF00;

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
    const [isGodMode, setGodMode] = React.useState(false);

    // Coordinate Transform: World (Yards) -> Screen (Pixels)
    // Scale: Fit 12k yards?
    const scale = Math.min(width, height) / (VIEW_RADIUS_YARDS * 2) * 0.9;

    // Check if Ownship is in the Green Zone of any TRACKED target with a valid solution
    // If selectedTrackerId is set, prioritize that. Or just any?
    // "If Ownship is physically inside the Green Zone" - implies relative to the specific target being viewed or all?
    // Usually tactical geometry is most relevant for the selected target.
    // Let's compute a global "idealSolution" flag based on the selected tracker.

    const selectedTracker = trackers.find(t => t.id === selectedTrackerId);
    let isSolutionIdeal = false;

    if (selectedTracker && selectedTracker.solution.range > 0) {
       // Re-calculate geometry for the selected tracker to determine zone status
       // This duplicates logic inside TrackerSymbol but is needed for the global UI overlay.
       // Ideally we could lift this state up, but for now we recalculate.

       // Project Target Position
       const sol = selectedTracker.solution;
       const timeDelta = gameTime - sol.anchorTime;
       const speedYps = sol.speed * 0.5629;
       const distTraveled = speedYps * timeDelta;

       const radAnchorBearing = (sol.bearing * Math.PI) / 180;
       const anchorTargetX = sol.anchorOwnShip.x + Math.sin(radAnchorBearing) * sol.range;
       const anchorTargetY = sol.anchorOwnShip.y + Math.cos(radAnchorBearing) * sol.range;

       const radCourse = (sol.course * Math.PI) / 180;
       const currentTargetX = anchorTargetX + Math.sin(radCourse) * distTraveled;
       const currentTargetY = anchorTargetY + Math.cos(radCourse) * distTraveled;

       // Vector Target -> Ownship
       const dx = ownShip.x - currentTargetX;
       const dy = ownShip.y - currentTargetY;

       // Bearing from Target to Ownship (0 is North)
       // Math.atan2(x, y) gives angle from North clockwise if x is East, y is North?
       // Standard atan2(y,x) is from East counter-clockwise.
       // Nav Math: atan2(x, y) = bearing from North (Y axis) clockwise.
       // x = East, y = North.
       let bearingFromTarget = Math.atan2(dx, dy) * (180 / Math.PI);
       if (bearingFromTarget < 0) bearingFromTarget += 360;

       // Aspect = BearingFromTarget - TargetHeading
       let aspect = bearingFromTarget - sol.course;
       // Normalize to -180 to 180
       while (aspect > 180) aspect -= 360;
       while (aspect <= -180) aspect += 360;

       // Green Zone: Stern +/- 60 deg -> Abs(Aspect) > 120 (since Stern is 180)
       // Wait. Stern is 180. +/- 60 is 120 to 240.
       // Normalized: 120 to 180 and -180 to -120.
       // So abs(aspect) >= 120.

       if (Math.abs(aspect) >= 120) {
           isSolutionIdeal = true;
       }
    }

    return (
        <div ref={parentRef} className="w-full h-full bg-[#001133] relative overflow-hidden select-none">
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: COLOR_BG, antialias: true }}>
                    <Container x={width / 2} y={height / 2}>
                        {/* 1. Grid / Range Rings */}
                        <RangeRings scale={scale} />

                        {/* 2. Trackers (Normal Mode) */}
                        {!isGodMode && trackers.map(tracker => (
                            <TrackerSymbol
                                key={tracker.id}
                                tracker={tracker}
                                ownShip={ownShip}
                                scale={scale}
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
                                scale={scale}
                            />
                        ))}

                        {/* 3. Torpedoes */}
                        {torpedoes.map(torpedo => (
                            <TorpedoSymbol
                                key={torpedo.id}
                                torpedo={torpedo}
                                ownShip={ownShip}
                                scale={scale}
                            />
                        ))}

                        {/* 4. Ownship (Last so it's on top) */}
                        <OwnShipSymbol heading={ownShip.heading} />
                    </Container>
                </Stage>
            )}

            {/* UI Overlays */}
            <div className="absolute top-2 left-2 text-cyan-500 font-mono text-xs opacity-70 pointer-events-none">
                <div>MODE: NORTH-UP</div>
                <div>SCALE: 10k YDS</div>
            </div>

            {/* GOD MODE TOGGLE */}
            <div className="absolute top-2 right-2 pointer-events-auto">
                <button
                    onClick={() => setGodMode(!isGodMode)}
                    className={`px-2 py-1 text-xs font-bold font-mono border rounded ${
                        isGodMode
                        ? 'bg-purple-900/80 text-purple-200 border-purple-500 animate-pulse'
                        : 'bg-black/50 text-zinc-600 border-zinc-800 hover:text-zinc-400'
                    }`}
                >
                    GOD
                </button>
            </div>

            {/* SOLUTION IDEAL INDICATOR */}
            {isSolutionIdeal && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-green-400 font-bold text-lg animate-pulse pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    SOLUTION IDEAL
                </div>
            )}
        </div>
    );
};

// --- Subcomponents ---

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
    // 1. Get the "Anchor" (The Fix)
    // We use computedWorldX/Y if available (it should be), otherwise fallback to calculating it.
    // Fallback is necessary for existing state that hasn't been updated yet (though a refresh fixes that).
    let fixX = solution.computedWorldX;
    let fixY = solution.computedWorldY;

    if (fixX === undefined || fixY === undefined) {
         const radAnchorBearing = (solution.bearing * Math.PI) / 180;
         fixX = solution.anchorOwnShip.x + Math.sin(radAnchorBearing) * solution.range * 3;
         fixY = solution.anchorOwnShip.y + Math.cos(radAnchorBearing) * solution.range * 3;
    }

    // 2. Project Forward (The DR Track)
    const timeDelta = gameTime - solution.anchorTime;
    // Speed in knots -> ft/sec. 1 knot = 1.6878 ft/sec
    const speedFps = solution.speed * 1.6878;
    const distTraveledFt = speedFps * timeDelta;

    const radCourse = (solution.course * Math.PI) / 180;
    const currentTargetX = fixX + Math.sin(radCourse) * distTraveledFt;
    const currentTargetY = fixY + Math.cos(radCourse) * distTraveledFt;

    // 3. Screen Coordinates (Relative to Ownship)
    // Map View: +Y is Up on Screen.
    // World: +Y is North.
    // So ScreenY = -(WorldY - OwnY).
    // ScreenX = (WorldX - OwnX).
    const relX = (currentTargetX - ownShip.x) * scale;
    const relY = -(currentTargetY - ownShip.y) * scale;

    // Fix Position (for visualization)
    const fixRelX = (fixX - ownShip.x) * scale;
    const fixRelY = -(fixY - ownShip.y) * scale;

    const isSolutionIncomplete = !solution.range || solution.range < 100;

    // Calculate Aspect/Zones for Valid Solution
    let inGreenZone = false;
    let targetAngle = 0; // Relative bearing of Ownship from Target

    if (!isSolutionIncomplete) {
        // Vector Target -> Ownship
        const dx = ownShip.x - currentTargetX;
        const dy = ownShip.y - currentTargetY;

        let bearingFromTarget = Math.atan2(dx, dy) * (180 / Math.PI); // 0=North
        if (bearingFromTarget < 0) bearingFromTarget += 360;

        // Aspect (relative to Target Heading)
        let aspect = bearingFromTarget - solution.course;
        while (aspect > 180) aspect -= 360;
        while (aspect <= -180) aspect += 360;

        inGreenZone = Math.abs(aspect) >= 120;
    }

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        const color = isSelected ? COLOR_SELECTED : COLOR_TRACKER_AMBER;
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
            // Only draw if we have moved enough to see it (e.g. > 1 px)
            // Fix Marker (Small X or Dot)
            g.lineStyle(1, color, 0.5);
            g.moveTo(fixRelX - 3, fixRelY - 3); g.lineTo(fixRelX + 3, fixRelY + 3);
            g.moveTo(fixRelX + 3, fixRelY - 3); g.lineTo(fixRelX - 3, fixRelY + 3);

            // DR Track (Dashed Line) - Pixi doesn't do dashed lines natively easily, so just thin solid line
            g.lineStyle(1, color, 0.3);
            g.moveTo(fixRelX, fixRelY);
            g.lineTo(relX, relY);

            // --- DRAW TACTICAL ZONES (Underneath Symbol) ---
            // Only draw zones if solution is valid.
            // Radius of cones: Let's pick a reasonable visual size, e.g. 2000 yards scaled or fixed pixels?
            // Fixed pixels might be better for UI clarity, but scaled gives tactical context.
            // Let's go with fixed pixels to avoid clutter at zoom, or scaled but clamped?
            // Task says "Draw Arcs (Extending from Target)". Let's use a fixed radius like 60px or scaled 1500yds.
            const zoneRadius = 1500 * scale;

            // Pixi Arc Logic:
            // 0 is East (+X).
            // North is -90 deg (-PI/2).
            // Target Course C corresponds to angle (C - 90).

            const toPixiAngle = (deg: number) => (deg - 90) * (Math.PI / 180);
            const course = solution.course;

            // Red Zone: +/- 30
            g.beginFill(COLOR_ZONE_RED, 0.2);
            g.moveTo(relX, relY);
            g.arc(relX, relY, zoneRadius, toPixiAngle(course - 30), toPixiAngle(course + 30));
            g.lineTo(relX, relY);
            g.endFill();

            // Yellow Zone: 30 to 120 (Starboard) and -30 to -120 (Port => 330 to 240)
            g.beginFill(COLOR_ZONE_YELLOW, 0.1);
            // Starboard Beam
            g.moveTo(relX, relY);
            g.arc(relX, relY, zoneRadius, toPixiAngle(course + 30), toPixiAngle(course + 120));
            g.lineTo(relX, relY);
            // Port Beam
            g.moveTo(relX, relY);
            g.arc(relX, relY, zoneRadius, toPixiAngle(course - 120), toPixiAngle(course - 30));
            g.lineTo(relX, relY);
            g.endFill();

            // Green Zone: 120 to 240 (Stern)
            // If inGreenZone (Ownship is there), highlight brighter
            const greenAlpha = (isSelected && inGreenZone) ? 0.4 : 0.2;
            g.beginFill(COLOR_ZONE_GREEN, greenAlpha);
            g.moveTo(relX, relY);
            g.arc(relX, relY, zoneRadius, toPixiAngle(course + 120), toPixiAngle(course + 240));
            g.lineTo(relX, relY);
            g.endFill();

            // --- DRAW SYMBOL ---
            g.lineStyle(lineWeight, color, alpha);
            const size = 6;
            g.drawRect(relX - size, relY - size, size * 2, size * 2);

            // Velocity Vector
            const vecLen = 40;
            const courseRad = (solution.course * Math.PI) / 180;
            const tipX = relX + Math.sin(courseRad) * vecLen;
            const tipY = relY - Math.cos(courseRad) * vecLen;

            g.moveTo(relX, relY);
            g.lineTo(tipX, tipY);
        }

    }, [relX, relY, isSolutionIncomplete, tracker.currentBearing, solution.course, isSelected, inGreenZone, scale, fixRelX, fixRelY]);

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
                        fill: isSelected ? COLOR_SELECTED : COLOR_TRACKER_AMBER
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
    // Colors
    // Enemy (SUB/ESCORT) -> Red
    // Neutral (MERCHANT/BIOLOGICAL) -> Green
    const isEnemy = contact.classification === 'SUB' || contact.classification === 'ESCORT';
    const color = isEnemy ? 0xFF0000 : 0x00FF00;

    const relX = (contact.x - ownShip.x) * scale;
    const relY = -(contact.y - ownShip.y) * scale;

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(2, color, 1);

        // Symbol
        if (isEnemy) {
            // Square for Enemy
            g.drawRect(-6, -6, 12, 12);
        } else {
            // Circle for Neutral
            g.drawCircle(0, 0, 6);
        }

        // Heading Vector
        if (contact.heading !== undefined) {
            const len = 20;
            const rad = (contact.heading * Math.PI) / 180;
            const vecX = Math.sin(rad) * len;
            const vecY = -Math.cos(rad) * len; // -Y is North (Up) on screen
            g.moveTo(0, 0);
            g.lineTo(vecX, vecY);
        }

        // ID Label
        // (Handled by Text component below)

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
