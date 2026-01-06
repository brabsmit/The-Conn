import React from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { Tracker, Torpedo } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';

// Colors
const COLOR_BG = 0x001133;
const COLOR_OWN_SHIP = 0xFFFFFF;
const COLOR_TRACKER_AMBER = 0xFFB000;
const COLOR_SELECTED = 0xFF8800; // Orange
const COLOR_TORPEDO = 0xFFFF00; // Yellow
const COLOR_RANGE_RING = 0x445566;

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
    const selectedTrackerId = useSubmarineStore(state => state.selectedTrackerId);
    const torpedoes = useSubmarineStore(state => state.torpedoes);
    const gameTime = useSubmarineStore(state => state.gameTime);

    // Coordinate Transform: World (Yards) -> Screen (Pixels)
    // Center is (width/2, height/2)
    // North Up means:
    // Screen X = (World X - OwnShip X) scaled + Center X
    // Screen Y = -(World Y - OwnShip Y) scaled + Center Y  (Flip Y because Screen Y is down)
    // Wait, Task says "North-Up (Standard Nav Plot). Ownship rotates in the center based on its heading."
    // Actually, usually "North Up" means North is Top of Screen. Ownship rotates.
    // "Course Up" means Ownship is Top of Screen. World rotates.
    // The task says: "Orientation: North-Up ... Ownship rotates in the center based on its heading."
    // So Map is fixed North=Up. Ship icon rotates.

    // Scale: Fit 12k yards?
    // Let's make it dynamic or fixed. Task suggests generic range rings.
    // Let's assume a fixed scale where 10k yards is visible.

    const scale = Math.min(width, height) / (VIEW_RADIUS_YARDS * 2) * 0.9;

    return (
        <div ref={parentRef} className="w-full h-full bg-[#001133] relative overflow-hidden select-none">
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: COLOR_BG, antialias: true }}>
                    <Container x={width / 2} y={height / 2}>
                        {/* 1. Grid / Range Rings */}
                        <RangeRings scale={scale} />

                        {/* 2. Trackers */}
                        {trackers.map(tracker => (
                            <TrackerSymbol
                                key={tracker.id}
                                tracker={tracker}
                                ownShip={ownShip}
                                scale={scale}
                                isSelected={tracker.id === selectedTrackerId}
                                gameTime={gameTime}
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

            {/* UI Overlays can go here (HTML) */}
            <div className="absolute top-2 left-2 text-cyan-500 font-mono text-xs opacity-70 pointer-events-none">
                <div>MODE: NORTH-UP</div>
                <div>SCALE: 10k YDS</div>
            </div>
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

    // Rotate container based on heading
    // Heading 0 is North (Up). Screen Y is Down.
    // So Heading 0 should point to -Y.
    // The polygon points to -Y (Nose at -15).
    // So rotation = heading.
    // PIXI rotation is radians clockwise.
    // If heading is 90 (East), we want to rotate 90 deg clockwise.
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

    // Determine position based on solution
    // If solution is valid (range > 0), calculate relative pos.
    // Else, draw bearing line.

    // Wait, the solution stores: anchorTime, anchorOwnShip, etc.
    // We need to project the solution to CURRENT time to see where the target SHOULD be now.
    // Or just visualize the solution parameters relative to OwnShip NOW?
    // Usually, NAV plot shows the computed position at current time.

    // We can use getProjectedPosition from tma.ts but I don't want to import logic if I can help it.
    // Let's implement simple projection here or assume solution is "current".
    // Actually `solution` in store is "The solution". It has an anchor time.
    // To draw it correctly on the map at the current time, we should project it forward.

    const timeDelta = gameTime - solution.anchorTime; // seconds
    // Convert speed (knots) to yards/sec. 1 knot ~= 0.56 yards/sec
    const speedYps = solution.speed * 0.5629;
    const distTraveled = speedYps * timeDelta; // yards

    // Initial position at anchor time relative to anchor ownship?
    // Solution defines: range, bearing from anchorOwnShip at anchorTime.

    // 1. Calculate World Position of Target at Anchor Time
    // anchorBearing is relative to North? Yes store says 0-359.
    const radAnchorBearing = (solution.bearing * Math.PI) / 180;
    const anchorTargetX = solution.anchorOwnShip.x + Math.sin(radAnchorBearing) * solution.range;
    const anchorTargetY = solution.anchorOwnShip.y + Math.cos(radAnchorBearing) * solution.range;

    // 2. Project Target Position to Current Time based on Course/Speed
    const radCourse = (solution.course * Math.PI) / 180;
    const currentTargetX = anchorTargetX + Math.sin(radCourse) * distTraveled;
    const currentTargetY = anchorTargetY + Math.cos(radCourse) * distTraveled;

    // 3. Calculate Screen Position (Relative to Current Ownship, Scaled)
    // North Up: +Y is North? No, standard math: +Y is North?
    // Wait, let's check `useSubmarineStore`.
    // updatePosition: x + sin(heading), y + cos(heading).
    // So if Heading 0 (North), we add to Y. So +Y is North.
    // If Heading 90 (East), we add to X. So +X is East.
    // This is Standard Math with Y=North, X=East.

    // Screen Coordinates:
    // Center is OwnShip.
    // Screen X = (TargetX - OwnX) * scale
    // Screen Y = -(TargetY - OwnY) * scale (Because Screen Y is Down, World Y is Up/North)

    const relX = (currentTargetX - ownShip.x) * scale;
    const relY = -(currentTargetY - ownShip.y) * scale;

    const isSolutionIncomplete = !solution.range || solution.range < 100;

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        const color = isSelected ? COLOR_SELECTED : COLOR_TRACKER_AMBER;
        const alpha = isSelected ? 1.0 : 0.8;
        const lineWeight = isSelected ? 3 : 2;

        if (isSolutionIncomplete) {
            // Draw Infinite Bearing Line
            // We use the CURRENT bearing from the tracker (sensor data) if available, or project?
            // "If Solution is Incomplete... draw Infinite Bearing Line... extending from Ownship down the tracked bearing."
            // The tracker.currentBearing is the sensor bearing.

            const bearing = tracker.currentBearing;
            const rad = (bearing * Math.PI) / 180;

            // Draw line from center to edge of screen
            // Since it's North Up, and 0 is North (+Y world, -Y screen)
            // Screen Vector: x = sin(bearing), y = -cos(bearing)

            const vecX = Math.sin(rad) * 1000; // arbitrary long length
            const vecY = -Math.cos(rad) * 1000;

            // Dashed line simulation (Pixi doesn't do dashed lines natively easily in v7 without plugin, assume solid stippled or just low alpha)
            // We'll use low alpha for "ghostly".
            g.lineStyle(2, color, 0.4);
            g.moveTo(0, 0);
            g.lineTo(vecX, vecY);

            // Label
            g.beginFill(color, 0.4);
            g.drawCircle(vecX * 0.1, vecY * 0.1, 4); // Small dot near ship
            g.endFill();

        } else {
            // Draw Target Symbol at Calculated Position
            g.lineStyle(lineWeight, color, alpha);

            // Symbol (Square)
            const size = 6;
            g.drawRect(relX - size, relY - size, size * 2, size * 2);

            // Velocity Vector
            // Course is world angle. 0 is North (+Y world, -Y screen).
            // Vector length proportional to speed? Or fixed "Leader" line?
            // Let's do 1 min leader.
            // 1 min distance = Speed (kts) / 60 * 2000 yds (approx)
            // Let's just normalize: 100px for full speed?
            // Let's use generic length for now: 50px.

            const vecLen = 40;
            const courseRad = (solution.course * Math.PI) / 180;
            const tipX = relX + Math.sin(courseRad) * vecLen;
            const tipY = relY - Math.cos(courseRad) * vecLen;

            g.moveTo(relX, relY);
            g.lineTo(tipX, tipY);

            // Label
            // We can't easily render text in Graphics, assume overlay or just symbol is enough.
        }

    }, [relX, relY, isSolutionIncomplete, tracker.currentBearing, solution.course, isSelected]);

    return (
        <React.Fragment>
            <Graphics draw={draw} />
            {/* Text Label for ID */}
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

    // Telemetry Position
    const relX = (torpedo.position.x - ownShip.x) * scale;
    const relY = -(torpedo.position.y - ownShip.y) * scale; // Flip Y

    const draw = React.useCallback((g: PIXI.Graphics) => {
        g.clear();

        if (torpedo.status === 'RUNNING') {
            g.lineStyle(1, COLOR_TORPEDO, 1);
            g.beginFill(COLOR_TORPEDO);

            // Triangle
            // Heading is world degrees. 0 is North (+Y world, -Y screen)
            const rad = (torpedo.heading * Math.PI) / 180;

            // We need to rotate the triangle points manually or use rotation prop.
            // Using rotation prop on container is cleaner but here we are in a loop inside a container.
            // Let's just draw a circle for simplicity or small triangle.
            g.drawCircle(0, 0, 3);
            g.endFill();

            // Wire Trace (History)?
            // Or just a line from Ownship to Torpedo (Wire)?
            // "Draw the Yellow Weapon Trace"
            // Usually this means the path it has taken.
            // We don't have full history in store for torpedo, just current pos.
            // But we know it launched from us?
            // Let's just draw the current position and a short tail vector opposite to heading.

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

export default GeoDisplay;
